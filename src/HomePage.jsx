import { useState } from "react";
import { useNavigate } from "react-router-dom";
import prepgenieLogo from './assets/prepgenie_logo.png';
import { ClipLoader } from "react-spinners";

function HomePage({ setQuestions, setResumeText, setJobDescription }) {
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [experience, setExperience] = useState("Entry-Level");
  const [jobDescription, setJD] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append('jobTitle', jobTitle);
    formData.append('company', company);
    formData.append('experience', experience);
    formData.append('jobDescription', jobDescription);
    if (resumeFile) formData.append('resume', resumeFile);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/generate-questions`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      const finalQuestions = Array.isArray(data.questions)
        ? data.questions
        : data.questions?.split('\n').map(q => q.trim()).filter(Boolean);

      setQuestions(finalQuestions);
      setJobDescription(jobDescription);
      const fileText = await resumeFile.text();
      setResumeText(fileText);
      navigate("/practice");
    } catch (error) {
      console.error('Error:', error);
      setQuestions([]);
    }

    setLoading(false);
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <img src={prepgenieLogo} alt="PrepGenie Logo" style={{ height: '100px' }} />
      </div>
      <h1>PrepGenie</h1>
      <p className="tagline">Not Just Practice. Personalized Practice.</p>
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ClipLoader color="#6c63ff" size={50} />
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <label>Job Title</label>
        <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        <label>Company</label>
        <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
        <label>Experience Level</label>
        <select value={experience} onChange={(e) => setExperience(e.target.value)}>
          <option value="Entry-Level">Entry-Level</option>
          <option value="Mid-Level">Mid-Level</option>
          <option value="Senior-Level">Senior-Level</option>
        </select>
        <label>Paste Job Description</label>
        <textarea rows="5" value={jobDescription} onChange={(e) => setJD(e.target.value)} />
        <label>Upload Resume</label>
        <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => setResumeFile(e.target.files[0])} />
        <button type="submit" disabled={loading}>{loading ? "Generating..." : "Generate Questions"}</button>
      </form>
    </div>
  );
}

export default HomePage;
