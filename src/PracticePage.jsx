import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";

function PracticePage({ questions, setQuestions, resumeText, jobDescription }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("learn");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(Array(questions.length).fill(""));
  const [evaluations, setEvaluations] = useState([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const synthRef = useRef(window.speechSynthesis);
  const recognitionRef = useRef(null);

  const handleNext = () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const speak = (text) => {
    const synth = synthRef.current;
    if ("speechSynthesis" in window) {
      if (synth.speaking) {
        synth.cancel();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      synth.speak(utterance);
    } else {
      alert("Your browser does not support text-to-speech.");
    }
  };

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech Recognition is only supported in Chrome.");
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const updated = [...answers];
      updated[currentIndex] += (updated[currentIndex] ? " " : "") + transcript;
      setAnswers(updated);
    };

    recognition.onerror = (event) => {
      console.error("STT Error:", event.error);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const fetchMoreQuestions = async (type) => {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("resume", resumeText);
    formData.append("jobDescription", jobDescription);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/generate-more-questions`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (Array.isArray(data.newQuestions)) {
        setQuestions((prev) => [...prev, ...data.newQuestions]);
      }
    } catch (error) {
      console.error("Error fetching more questions:", error);
    }
  };

  const handleSubmitForEvaluation = async () => {
    // Prepare question-answer pairs for evaluation
    const qaPairs = filteredQuestions.map((question, index) => ({
      question: question.replace(/^\d+\.\s*/, ""),
      answer: answers[index] || ""
    })).filter(pair => pair.answer.trim() !== ""); // Only include answered questions

    if (qaPairs.length === 0) {
      alert("Please answer at least one question before submitting for evaluation.");
      return;
    }

    setIsEvaluating(true);
    setShowResults(false);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/evaluate-answers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          qaPairs: qaPairs
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.evaluations && Array.isArray(data.evaluations)) {
        setEvaluations(data.evaluations);
        setShowResults(true);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error evaluating answers:", error);
      alert("Failed to evaluate answers. Please try again.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const parseEvaluation = (evaluationText) => {
    const lines = evaluationText.split('\n').filter(line => line.trim());
    let feedback = "";
    let improvement = "";
    let score = "";

    // Try to find feedback section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes('feedback:')) {
        feedback = line.replace(/^.*feedback:\s*/i, '').trim();
        // If feedback is empty, look for content in next lines
        if (!feedback) {
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].toLowerCase().includes('improvement:') || 
                lines[j].toLowerCase().includes('score:')) break;
            feedback += (feedback ? ' ' : '') + lines[j].trim();
          }
        }
      }
    }

    // Try to find improvement section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes('improvement:')) {
        improvement = line.replace(/^.*improvement.*:\s*/i, '').trim();
        // If improvement is empty, look for content in next lines
        if (!improvement) {
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].toLowerCase().includes('score:')) break;
            improvement += (improvement ? ' ' : '') + lines[j].trim();
          }
        }
      }
    }

    // Try to find score section
    for (const line of lines) {
      if (line.toLowerCase().includes('score:')) {
        let scoreMatch = line.replace(/^.*score:\s*/i, '').trim();
        // Extract just the number if it exists
        const numberMatch = scoreMatch.match(/(\d+)/);
        if (numberMatch) {
          score = numberMatch[1] + '/10';
        } else {
          score = scoreMatch;
        }
        break;
      }
    }

    // If no structured format found, try to extract from the full text
    if (!feedback && !improvement && !score) {
      // Look for any numeric score in the text
      const scoreMatch = evaluationText.match(/(\d+)(\s*\/\s*10|\s*out\s*of\s*10)/i);
      if (scoreMatch) {
        score = scoreMatch[1] + '/10';
      }
      
      // Use the full text as feedback if no structure found
      if (!feedback) {
        feedback = evaluationText.trim();
      }
    }

    return { feedback, improvement, score };
  };

  const isValidQuestion = (q) => {
    const trimmed = q.trim();
    const lower = trimmed.toLowerCase();

    const headings = [
      /^technical questions?:?$/i,
      /^behavioral questions?:?$/i,
      /^situational questions?:?$/i,
      /^general questions?:?$/i,
      /^questions?:?$/i,
      /^interview questions?:?$/i,
      /^here are.*questions?/i,
      /^below are.*questions?/i,
      /^the following.*questions?/i,
      /^these questions? are designed/i,
      /^interview questions? that would be/i,
      /^likely asked for the/i,
      /^position at/i,
      /^focus\.?\s*prepare\.?\s*shine\.?/i,
      /^\d+\.\s*(technical|behavioral) questions?:?$/i,
    ];

    for (const pattern of headings) {
      if (pattern.test(trimmed)) return false;
    }

    if (/^\d+\.\s*$/.test(trimmed)) return false;

    const questionWords = [
      "what", "how", "why", "when", "where", "who", "which", "can you",
      "do you", "have you", "tell me", "describe", "explain", "walk me through"
    ];

    const hasQM = trimmed.includes("?");
    const startsWithQuestionWord = questionWords.some(word => lower.startsWith(word));

    return trimmed.length >= 20 && (hasQM || startsWithQuestionWord);
  };

  const technicalQuestions = questions.filter((q) => {
    if (!isValidQuestion(q)) return false;
    const lq = q.toLowerCase();
    return (
      lq.includes("technical") || lq.includes("algorithm") || lq.includes("code") ||
      lq.includes("programming") || lq.includes("system") || lq.includes("architecture") ||
      lq.includes("design") || lq.includes("implement") || lq.includes("debug") ||
      lq.includes("technology") || lq.includes("framework") || lq.includes("api")
    );
  });

  const behavioralQuestions = questions.filter((q) => {
    if (!isValidQuestion(q)) return false;
    const lq = q.toLowerCase();
    return (
      lq.includes("tell me about") || lq.includes("describe a time") ||
      lq.includes("how do you handle") || lq.includes("what would you do") ||
      lq.includes("conflict") || lq.includes("leadership") || lq.includes("teamwork")
    );
  });

  const filteredQuestions = [...technicalQuestions, ...behavioralQuestions];

  const questionCardStyle = {
    backgroundColor: "#f0f4ff",
    padding: "15px",
    borderRadius: "12px",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
    transition: "all 0.3s ease",
    fontSize: "16px",
    fontWeight: "500",
    lineHeight: "1.5",
  };

  const evaluationCardStyle = {
    backgroundColor: "#ffffff",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
    marginBottom: "20px",
    border: "1px solid #e0e0e0",
  };

  return (
    <div className="container">
      <h1>Practice Your Interview Questions</h1>
      <p className="tagline">Focus. Prepare. Shine.</p>

      <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginBottom: "20px" }}>
        <button
          onClick={() => setMode("learn")}
          style={{
            backgroundColor: mode === "learn" ? "#6c63ff" : "#eee",
            color: mode === "learn" ? "#fff" : "#333",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Learn
        </button>
        <button
          onClick={() => setMode("practice")}
          style={{
            backgroundColor: mode === "practice" ? "#6c63ff" : "#eee",
            color: mode === "practice" ? "#fff" : "#333",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Practice
        </button>
        {evaluations.length > 0 && (
          <button
            onClick={() => setShowResults(!showResults)}
            style={{
              backgroundColor: showResults ? "#ff6b6b" : "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {showResults ? "Hide Results" : "Show Results"}
          </button>
        )}
      </div>

      {showResults && evaluations.length > 0 ? (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", color: "#333", marginBottom: "30px" }}>Your Interview Evaluation Results</h2>
          {evaluations.map((evaluation, index) => {
            const parsed = parseEvaluation(evaluation.evaluation);
            return (
              <div key={index} style={evaluationCardStyle}>
                <h3 style={{ color: "#6c63ff", marginBottom: "10px" }}>Question {index + 1}</h3>
                <div style={{ backgroundColor: "#f8f9fa", padding: "10px", borderRadius: "8px", marginBottom: "15px" }}>
                  <ReactMarkdown>{evaluation.question}</ReactMarkdown>
                </div>
                
                <div style={{ backgroundColor: "#e8f5e8", padding: "10px", borderRadius: "8px", marginBottom: "15px" }}>
                  <strong style={{ color: "#2e7d32" }}>Your Answer:</strong>
                  <p style={{ marginTop: "5px", color: "#333" }}>{evaluation.answer}</p>
                </div>

                <div style={{ display: "grid", gap: "15px" }}>
                  {/* Always show feedback - use full evaluation if no structured feedback found */}
                  <div>
                    <strong style={{ color: "#1976d2" }}>Feedback:</strong>
                    <p style={{ marginTop: "5px", color: "#333" }}>
                      {parsed.feedback || "No specific feedback provided."}
                    </p>
                  </div>
                  
                  {/* Always show improvement suggestions */}
                  <div>
                    <strong style={{ color: "#f57c00" }}>Improvement Suggestions:</strong>
                    <p style={{ marginTop: "5px", color: "#333" }}>
                      {parsed.improvement || "No specific improvement suggestions provided."}
                    </p>
                  </div>
                  
                  {/* Always show score */}
                  <div>
                    <strong style={{ color: "#d32f2f" }}>Score:</strong>
                    <span style={{ 
                      marginLeft: "10px", 
                      fontSize: "18px", 
                      fontWeight: "bold", 
                      color: "#d32f2f" 
                    }}>
                      {parsed.score || "Not provided"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : mode === "learn" ? (
        <>
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "20px" }}>
            <button onClick={() => fetchMoreQuestions("technical")}>More Technical Questions</button>
            <button onClick={() => fetchMoreQuestions("behavioral")}>More Behavioral Questions</button>
          </div>

          <h2 style={{ marginTop: "30px", marginBottom: "10px", color: "#333" }}>Technical Questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {technicalQuestions.map((q, index) => (
              <div key={`tech-${index}`} style={questionCardStyle}>
                <span style={{ fontWeight: 600, color: "#003366" }}>Technical</span>
                <ReactMarkdown>{q.replace(/^\d+\.\s*/, "")}</ReactMarkdown>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: "40px", marginBottom: "10px", color: "#333" }}>Behavioral Questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {behavioralQuestions.map((q, index) => (
              <div key={`beh-${index}`} style={questionCardStyle}>
                <span style={{ fontWeight: 600, color: "#1b5e20" }}>Behavioral</span>
                <ReactMarkdown>{q.replace(/^\d+\.\s*/, "")}</ReactMarkdown>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center" }}>
          {filteredQuestions.length > 0 ? (
            <>
              <div style={{ ...questionCardStyle, maxWidth: "600px", margin: "0 auto", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => speak(filteredQuestions[currentIndex])}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: "20px",
                      cursor: "pointer",
                      marginBottom: "5px",
                    }}
                    aria-label="Play question"
                  >
                    🔊
                  </button>
                </div>
                <ReactMarkdown>{filteredQuestions[currentIndex].replace(/^\d+\.\s*/, "")}</ReactMarkdown>
              </div>

              <div style={{ marginTop: "20px", maxWidth: "600px", marginInline: "auto" }}>
                <textarea
                  rows="6"
                  placeholder="Type your answer here..."
                  value={answers[currentIndex] || ""}
                  onChange={(e) => {
                    const updated = [...answers];
                    updated[currentIndex] = e.target.value;
                    setAnswers(updated);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    fontSize: "15px",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
                <button
                  onClick={startListening}
                  style={{
                    marginTop: "10px",
                    padding: "8px 16px",
                    backgroundColor: "#6c63ff",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  🎙 Speak Your Answer
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px" }}>
                <button onClick={handlePrev} disabled={currentIndex === 0}>
                  Previous
                </button>
                <button onClick={handleNext} disabled={currentIndex === filteredQuestions.length - 1}>
                  Next
                </button>
              </div>

              <div style={{ marginTop: "30px" }}>
                <button
                  onClick={handleSubmitForEvaluation}
                  disabled={isEvaluating}
                  style={{
                    backgroundColor: isEvaluating ? "#cccccc" : "#4CAF50",
                    color: "white",
                    padding: "12px 24px",
                    fontSize: "16px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: isEvaluating ? "not-allowed" : "pointer",
                    opacity: isEvaluating ? 0.7 : 1,
                  }}
                >
                  {isEvaluating ? "Evaluating..." : "Submit & Get Feedback"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <h3>No valid questions found</h3>
              <p>Please generate questions first or check if the AI response contains valid interview questions.</p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => navigate("/")}
        style={{
          marginTop: "40px",
          padding: "10px 20px",
          backgroundColor: "#6c63ff",
          color: "white",
          border: "none",
          borderRadius: "10px",
          fontSize: "16px",
          fontWeight: "600",
          cursor: "pointer",
        }}
      >
        Back to Home
      </button>
    </div>
  );
}

export default PracticePage;