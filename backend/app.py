import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import fitz  # PyMuPDF for PDF
import docx  # python-docx for DOCX
load_dotenv()

app = Flask(__name__)
app.config['PROPAGATE_EXCEPTIONS'] = True
CORS(app)

# Your Groq API Key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def extract_text_from_pdf(file_path):
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text


def extract_text_from_docx(file_path):
    doc = docx.Document(file_path)
    text = ""
    for para in doc.paragraphs:
        text += para.text + "\n"
    return text


@app.route('/')
def home():
    return "PrepGenie Backend is Running!"


@app.route('/generate-questions', methods=['POST'])
def generate_questions():
    try:
        job_title = request.form.get('jobTitle')
        company = request.form.get('company')
        experience = request.form.get('experience')
        job_description = request.form.get('jobDescription')
        resume_file = request.files.get('resume')

        resume_text = ""

        if resume_file:
            filename = resume_file.filename.lower()
            file_path = f"./{resume_file.filename}"
            resume_file.save(file_path)

            if filename.endswith(".pdf"):
                resume_text = extract_text_from_pdf(file_path)
            elif filename.endswith(".docx"):
                resume_text = extract_text_from_docx(file_path)
            else:
                return jsonify({"error": "Unsupported file format. Please upload PDF or DOCX."}), 400

        prompt = f"""
You are an AI specialized in preparing customized job interview questions.

Given the following details:
- Job Title: {job_title}
- Company: {company}
- Experience Level: {experience}
- Job Description: {job_description}
- Candidate Resume Content: {resume_text}

Generate 5 technical interview questions and 5 behavioral interview questions that would be likely asked for this position. 
Label them clearly as "Technical Questions" and "Behavioral Questions".
"""

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        body = {
            "model": "llama3-70b-8192",
            "messages": [
                {"role": "system", "content": "You are an expert career coach."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1024,
            "top_p": 1,
            "stop": None,
            "stream": False
        }

        groq_response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=body
        )

        if groq_response.status_code != 200:
            print("Groq API Error:", groq_response.text)
            return jsonify({"error": "Failed to fetch from Groq"}), 500

        groq_data = groq_response.json()
        ai_response_text = groq_data['choices'][0]['message']['content']
        questions = [q.strip() for q in ai_response_text.split('\n') if q.strip()]

        return jsonify({'questions': questions})

    except Exception as e:
        print("Exception occurred:", str(e))
        return jsonify({"error": "Internal Server Error"}), 500


@app.route('/generate-more-questions', methods=['POST'])
def generate_more_questions():
    try:
        question_type = request.form.get('type')
        resume_text = request.form.get('resume', '')[:2000]
        job_description = request.form.get('jobDescription', '')[:1500]

        if not question_type or not resume_text or not job_description:
            print("❌ Missing inputs for type, resume or JD")
            return jsonify({"error": "Missing inputs"}), 400

        prompt = f"""
You are an AI that generates high-quality interview questions.

Given the following candidate resume and job description:
Resume: {resume_text}
Job Description: {job_description}

Generate 5 {question_type} interview questions that are relevant, realistic, and personalized.
Return just the questions, one per line.
"""

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        body = {
            "model": "llama3-70b-8192",
            "messages": [
                {"role": "system", "content": "You are a helpful interview coach."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1024
        }

        groq_response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=body
        )

        if groq_response.status_code != 200:
            print("Groq error:", groq_response.text)
            return jsonify({"error": "Failed to generate more questions"}), 500

        result_text = groq_response.json()['choices'][0]['message']['content']
        new_questions = [q.strip() for q in result_text.split('\n') if q.strip()]

        return jsonify({"newQuestions": new_questions})

    except Exception as e:
        print("Exception in generate_more_questions:", str(e))
        return jsonify({"error": "Internal Server Error"}), 500


# ✅ NEW: Evaluate answers API
@app.route('/evaluate-answers', methods=['POST'])
def evaluate_answers():
    try:
        data = request.get_json()
        qa_pairs = data.get("qaPairs", [])

        evaluations = []

        for pair in qa_pairs:
            question = pair.get("question", "")
            answer = pair.get("answer", "")

            prompt = f"""
You are an AI interview coach. Evaluate the following candidate response:

Question: {question}
Answer: {answer}

Provide:
- Constructive feedback
- Suggestions for improvement
- A score out of 10

Use this format:
Feedback: ...
Improvement: ...
Score: ...
"""

            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }

            body = {
                "model": "llama3-70b-8192",
                "messages": [
                    {"role": "system", "content": "You are a helpful AI interview coach."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 500
            }

            groq_response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=body
            )

            if groq_response.status_code != 200:
                print("Evaluation error:", groq_response.text)
                return jsonify({"error": "Groq evaluation failed"}), 500

            content = groq_response.json()['choices'][0]['message']['content']
            evaluations.append({
                "question": question,
                "answer": answer,
                "evaluation": content
            })

        return jsonify({"evaluations": evaluations})

    except Exception as e:
        print("Evaluation exception:", str(e))
        return jsonify({"error": "Evaluation failed"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
