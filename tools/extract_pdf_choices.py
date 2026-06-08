import io
import json
import re
import unicodedata
from pathlib import Path

import pikepdf
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = Path(r"C:\quiz-source-pdfs")
OUTPUT = ROOT / "data" / "original-choices.js"


def normalize(value):
    value = unicodedata.normalize("NFKC", str(value)).strip()
    value = re.sub(r"[إأآ]", "ا", value)
    value = value.replace("ى", "ي").replace("ة", "ه")
    value = re.sub(r"[ًٌٍَُِّْـ]", "", value)
    value = re.sub(r"[^\w%]+", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip().lower()


def correct_arabic(value):
    value = unicodedata.normalize("NFKC", value).strip()
    value = re.sub(r"[ًٌٍَُِّْـ]", "", value)
    value = value.replace("اإ", "الإ").replace("اأ", "الأ").replace("اآ", "الآ").replace("اال", "ال")
    corrections = {
        "الاجراءات": "الإجراءات",
        "الافراد": "الأفراد",
        "الالات": "الآلات",
        "الالكتروني": "الإلكتروني",
        "الالكترونية": "الإلكترونية",
        "الاساليب": "الأساليب",
        "الاسباب": "الأسباب",
        "الاخطاء": "الأخطاء",
        "الاقل": "الأقل",
        "الاكثر": "الأكثر",
        "الاسرع": "الأسرع",
        "الابطأ": "الأبطأ",
        "الاعلى": "الأعلى",
        "الاعمق": "الأعمق",
    }
    for wrong, right in corrections.items():
        value = re.sub(rf"\b{wrong}\b", right, value)
    return re.sub(r"\s+", " ", value).strip()


def reconcile_answer(choices, source_answer, corrected_answer):
    source_answer = correct_arabic(source_answer)
    corrected_answer = correct_arabic(corrected_answer)
    source_norm = normalize(source_answer)
    corrected_norm = normalize(corrected_answer)

    for index, choice in enumerate(choices):
        if normalize(choice) in {source_norm, corrected_norm}:
            choices[index] = corrected_answer
            return choices

    for index, choice in enumerate(choices):
        choice_norm = normalize(choice)
        if source_norm and source_norm in choice_norm:
            source_words = source_norm.split()
            original_words = choice.split()
            remainder = [
                word for word in original_words
                if normalize(word) not in source_words
            ]
            choices[index] = corrected_answer
            if remainder:
                choices.insert(index + 1, correct_arabic(" ".join(remainder)))
            return choices

    source_words = set(source_norm.split())
    overlaps = [
        (len(source_words.intersection(normalize(choice).split())), index)
        for index, choice in enumerate(choices)
    ]
    overlap_count, target_index = max(overlaps, default=(0, 0))
    if overlap_count:
        for index, choice in enumerate(choices):
            if index == target_index:
                continue
            remaining = [
                word for word in choice.split()
                if normalize(word) not in source_words
            ]
            choices[index] = correct_arabic(" ".join(remaining))
        choices = [choice for choice in choices if choice]
        choices[target_index if target_index < len(choices) else 0] = corrected_answer
        return choices

    choices.append(corrected_answer)
    return choices


def build_font_maps(page):
    maps = {}
    for name, font in page.Resources.Font.items():
        descendant = font.DescendantFonts[0]
        font_file = descendant.FontDescriptor.FontFile2.read_bytes()
        tt_font = TTFont(io.BytesIO(font_file))
        glyph_order = tt_font.getGlyphOrder()
        glyph_to_unicode = {glyph: chr(codepoint) for codepoint, glyph in tt_font.getBestCmap().items()}
        cid_map = descendant.get("/CIDToGIDMap", "/Identity")
        maps[str(name)] = (glyph_order, glyph_to_unicode, cid_map)
    return maps


def decode_pdf_string(value, font_name, font_maps):
    raw = bytes(value)
    glyph_order, glyph_to_unicode, cid_map = font_maps[font_name]
    decoded = []
    for index in range(0, len(raw), 2):
        cid = int.from_bytes(raw[index:index + 2], "big")
        if str(cid_map) == "/Identity":
            glyph_id = cid
        else:
            mapping = cid_map.read_bytes()
            glyph_id = int.from_bytes(mapping[cid * 2:cid * 2 + 2], "big")
        if glyph_id < len(glyph_order):
            decoded.append(glyph_to_unicode.get(glyph_order[glyph_id], ""))
    return unicodedata.normalize("NFKC", "".join(decoded))


def readable_token(value):
    value = value.strip()
    if re.search(r"[\u0600-\u06ff]", value):
        value = value[::-1]
    return correct_arabic(value)


def page_tokens(page):
    font_maps = build_font_maps(page)
    current_font = None
    tokens = []
    for instruction in pikepdf.parse_content_stream(page):
        operator = str(instruction.operator)
        operands = instruction.operands
        if operator == "Tf":
            current_font = str(operands[0])
        elif operator == "Tj":
            text = decode_pdf_string(operands[0], current_font, font_maps)
            if text.strip():
                tokens.append(text)
        elif operator == "TJ":
            text = "".join(
                decode_pdf_string(item, current_font, font_maps)
                for item in operands[0]
                if isinstance(item, pikepdf.String)
            )
            if text.strip():
                tokens.append(text)
    return tokens


def extract_pdf(pdf_path):
    extracted = []
    pdf = pikepdf.open(pdf_path)
    for page in pdf.pages:
        tokens = page_tokens(page)
        current_question = None
        state = None
        choices = []
        choice_parts = []
        answer = None
        pending_number = None

        def flush_choice():
            nonlocal choice_parts
            value = correct_arabic(" ".join(part for part in choice_parts if part).strip())
            if value:
                choices.append(value)
            choice_parts = []

        def finish():
            nonlocal current_question, choices, answer
            flush_choice()
            if current_question is None or not choices:
                return
            clean_choices = []
            for choice in choices:
                choice = correct_arabic(choice)
                if choice and choice not in clean_choices:
                    clean_choices.append(choice)
            clean_answer = correct_arabic(answer or "")
            if clean_answer and not any(normalize(choice) == normalize(clean_answer) for choice in clean_choices):
                clean_choices.append(clean_answer)
            extracted.append({
                "printedNumber": current_question,
                "choices": clean_choices,
                "answer": clean_answer,
            })

        for raw_token in tokens:
            token = raw_token.strip()
            number_match = re.search(r":\s*(\d+)\s*$", token)
            if number_match:
                pending_number = int(number_match.group(1))
                continue
            if token.strip() == "لاؤس" and pending_number is not None:
                finish()
                current_question = pending_number
                choices = []
                choice_parts = []
                answer = None
                state = "question"
                pending_number = None
                continue
            if token == "تارايخلا":
                state = "choices"
                continue
            if token == "ةباجلإا":
                flush_choice()
                state = "answer"
                continue
            if token == ":":
                continue

            if state == "choices":
                if "|" in token:
                    parts = token.split("|")
                    for part_index, part in enumerate(parts):
                        value = readable_token(part)
                        if value:
                            choice_parts.append(value)
                        if part_index < len(parts) - 1:
                            flush_choice()
                    continue
                value = readable_token(token)
                if value:
                    choice_parts.append(value)
            elif state == "answer" and answer is None:
                answer = readable_token(token)
                state = "done"

        finish()
    return extracted


def load_corrected_data():
    lectures = json.loads((ROOT / "tools" / "corrected-data.json").read_text(encoding="utf-8"))
    return {
        lecture["id"]: [[question["question"], question["answer"]] for question in lecture["questions"]]
        for lecture in lectures
    }


def write_output(lectures):
    serialized = json.dumps(lectures, ensure_ascii=False, indent=2)
    OUTPUT.write_text(
        "(() => {\n"
        f"  const choicesByLecture = {serialized};\n\n"
        "  Object.entries(choicesByLecture).forEach(([lectureId, questions]) => {\n"
        "    const lecture = window.QUIZ_DATA?.find((item) => item.id === lectureId);\n"
        "    if (!lecture) return;\n\n"
        "    questions.forEach((choices, index) => {\n"
        "      const question = lecture.questions[index];\n"
        "      if (!question) return;\n"
        "      question.choices = choices;\n"
        "      const correctedAnswer = choices.find((choice) => normalizeChoice(choice) === normalizeChoice(question.answer));\n"
        "      if (correctedAnswer) question.answer = correctedAnswer;\n"
        "    });\n"
        "  });\n\n"
        "  function normalizeChoice(value) {\n"
        "    return String(value).trim().replace(/[إأآ]/g, \"ا\").replace(/ى/g, \"ي\").replace(/ة/g, \"ه\")\n"
        "      .replace(/[ًٌٍَُِّْـ]/g, \"\").replace(/[^\\p{L}\\p{N}%]+/gu, \" \").replace(/\\s+/g, \" \").trim().toLowerCase();\n"
        "  }\n"
        "})();\n",
        encoding="utf-8",
    )


def main():
    corrected = load_corrected_data()
    output = {}
    for lecture_number in range(1, 8):
        lecture_id = f"lec{lecture_number}"
        extracted = extract_pdf(PDF_DIR / f"Lec{lecture_number}_Q&A.pdf")
        extracted_by_number = {item["printedNumber"]: item for item in extracted}
        rows = corrected[lecture_id]
        skipped_numbers = {2: {5}, 3: {4}, 4: {79}}.get(lecture_number, set())
        printed_numbers = []
        candidate = 1
        while len(printed_numbers) < len(rows):
            if candidate not in skipped_numbers:
                printed_numbers.append(candidate)
            candidate += 1
        choices = []
        for index, row in enumerate(rows):
            item = extracted_by_number.get(printed_numbers[index])
            if not item:
                choices.append([])
                continue
            corrected_answer = correct_arabic(row[1])
            item_choices = item["choices"]
            source_answer = item["answer"]
            choices.append(reconcile_answer(item_choices, source_answer, corrected_answer))
        output[lecture_id] = choices
        valid = sum(1 for item in choices if len(item) > 1)
        print(f"{lecture_id}: extracted {len(extracted)}, mapped {valid}/{len(rows)}")
    write_output(output)


if __name__ == "__main__":
    main()
