import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import PracticePage from "./PracticePage";

function App() {
  const [questions, setQuestions] = useState([]);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  return (
    <Routes>
      <Route path="/" element={
        <HomePage 
          setQuestions={setQuestions} 
          setResumeText={setResumeText}
          setJobDescription={setJobDescription}
        />} 
      />
      <Route path="/practice" element={
        <PracticePage 
          questions={questions} 
          setQuestions={setQuestions}
          resumeText={resumeText}
          jobDescription={jobDescription}
        />} 
      />
    </Routes>
  );
}

export default App;