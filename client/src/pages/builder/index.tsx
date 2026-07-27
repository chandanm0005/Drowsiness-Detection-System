import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Upload, FileText, AlertCircle, CheckCircle2, Plus, Trash2, Download, LayoutTemplate } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

import yaml from 'js-yaml';
import { jsPDF } from 'jspdf';

// Custom Textarea with inline "ghost" suggestions
function GhostTextarea({ value, onChange, suggestion, placeholder, className, ...props }: any) {
  const [dismissed, setDismissed] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !value && suggestion && !dismissed) {
      e.preventDefault();
      onChange(suggestion);
      setDismissed(true);
    }
  };

  return (
    <div className="relative w-full">
      {!value && suggestion && !dismissed && (
        <div 
          className="absolute top-[9px] left-[13px] right-[13px] pointer-events-none text-primary/40 font-mono text-sm whitespace-pre-wrap select-none"
        >
          {suggestion}
          <div className="mt-4 text-xs text-primary/70 flex items-center gap-1.5 bg-primary/10 w-fit px-2.5 py-1.5 rounded-md border border-primary/20 backdrop-blur-sm shadow-lg">
            <Sparkles className="w-3 h-3" /> Press Tab to accept (Boosts ATS Score)
          </div>
        </div>
      )}
      <Textarea
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (e.target.value) setDismissed(true);
        }}
        onClick={() => setDismissed(true)}
        onKeyDown={handleKeyDown}
        placeholder={dismissed || value ? placeholder : ""}
        className={`relative z-10 bg-transparent min-h-[140px] ${className}`}
        {...props}
      />
    </div>
  );
}

export default function BuilderPage() {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState("info");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for Info form
  const [personalInfo, setPersonalInfo] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: ""
  });

  // Dynamic state (initially empty to allow users to fill their details)
  const [experiences, setExperiences] = useState([
    { id: 1, title: "", company: "", description: "", showSuggestions: false }
  ]);

  const [projects, setProjects] = useState([
    { id: 1, title: "", technologies: "", description: "" }
  ]);

  const [education, setEducation] = useState([
    { id: 1, school: "", degree: "", year: "" }
  ]);

  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");
  
  // State for JD matching
  const [requiredSkills, setRequiredSkills] = useState([
    { name: 'React.js', present: true },
    { name: 'Node.js', present: true },
    { name: 'PostgreSQL', present: false },
    { name: 'Docker', present: false },
    { name: 'AWS', present: false }
  ]);
  
  // Update presence based on user input
  useEffect(() => {
    const allText = [
      ...experiences.map(e => `${e.title} ${e.description}`),
      ...projects.map(p => `${p.title} ${p.technologies} ${p.description}`)
    ].join(' ').toLowerCase();

    setRequiredSkills(skills => 
      skills.map(skill => ({
        ...skill,
        present: allText.includes(skill.name.toLowerCase()) || allText.includes(skill.name.split('.')[0].toLowerCase())
      }))
    );
  }, [experiences, projects]);

  const matchScore = Math.round((requiredSkills.filter(s => s.present).length / Math.max(requiredSkills.length, 1)) * 100) || 0;
  const missingSkills = requiredSkills.filter(s => !s.present);
  
  const dynamicSuggestion = missingSkills.length > 0 
    ? `• Implemented scalable architecture using ${missingSkills[0].name}, resulting in 30% faster load times.\n• Collaborated with cross-functional teams to integrate ${missingSkills.length > 1 ? missingSkills[1].name : 'new features'} seamlessly.`
    : "• Led a team of 5 engineers to deliver the project 2 weeks ahead of schedule.\n• Optimized database queries resulting in 40% reduction in API latency.";

  const simulateAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      // Basic mock keyword extraction from JD
      const text = jdText.toLowerCase();
      const commonSkills = [
        'React.js', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Java', 'C++', 'Go', 'Ruby',
        'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'AWS', 'Kubernetes', 'GCP', 'Azure',
        'HTML', 'CSS', 'Tailwind', 'Git', 'Agile', 'Scrum', 'GraphQL', 'REST API', 'Figma', 'Machine Learning', 'AI'
      ];
      
      const newSkills = commonSkills
        .filter(skill => text.includes(skill.toLowerCase()) || text.includes(skill.split('.')[0].toLowerCase()))
        .map(skill => ({ name: skill, present: false }));
      
      if (newSkills.length > 0) {
        setRequiredSkills(newSkills);
      } else if (jdText.trim().length > 0) {
        // If they pasted something but no known skills found, add some generic ones to show UI
        setRequiredSkills([
          { name: 'Communication', present: false },
          { name: 'Problem Solving', present: false },
          { name: 'Leadership', present: false }
        ]);
      }
      
      // If user pasted their resume, let's "mock" parsing it into the fields
      if (resumeText.trim().length > 50) {
        setPersonalInfo(prev => ({ ...prev, name: "Parsed User Name", email: "user@example.com" }));
        setExperiences([{
          id: Date.now(),
          title: "Parsed Job Title",
          company: "Parsed Company",
          description: "• Extracted bullet point 1 from your resume\n• Extracted bullet point 2 from your resume",
          showSuggestions: false
        }]);
      }
      
      setIsAnalyzing(false);
      setStep(2);
    }, 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast({
        title: "Analyzing Resume",
        description: "Extracting skills and experience from your PDF...",
      });
      
      setTimeout(() => {
        toast({
          title: "Import Complete",
          description: "Successfully populated your experience and skills.",
        });
        setExperiences([
          {
            id: Date.now(),
            title: "Senior Developer",
            company: "Innovate Inc",
            description: "• Led migration to microservices\n• Managed a team of 5 engineers",
            showSuggestions: false
          },
          ...experiences
        ]);
      }, 1500);
    }
  };

  // --- Experience Handlers ---
  const addExperience = () => setExperiences([...experiences, { id: Date.now(), title: "", company: "", description: "", showSuggestions: false }]);
  const removeExperience = (id: number) => setExperiences(experiences.filter(exp => exp.id !== id));
  const updateExperience = (id: number, field: string, value: string) => setExperiences(experiences.map(exp => exp.id === id ? { ...exp, [field]: value } : exp));

  // --- Project Handlers ---
  const addProject = () => setProjects([...projects, { id: Date.now(), title: "", technologies: "", description: "" }]);
  const removeProject = (id: number) => setProjects(projects.filter(p => p.id !== id));
  const updateProject = (id: number, field: string, value: string) => setProjects(projects.map(p => p.id === id ? { ...p, [field]: value } : p));

  // --- Education Handlers ---
  const addEducation = () => setEducation([...education, { id: Date.now(), school: "", degree: "", year: "" }]);
  const removeEducation = (id: number) => setEducation(education.filter(e => e.id !== id));
  const updateEducation = (id: number, field: string, value: string) => setEducation(education.map(e => e.id === id ? { ...e, [field]: value } : e));

  const handlePreview = () => {
    setShowPreview(true);
  };

  const handleExportYAML = () => {
    // Transform our form data into RenderCV YAML format
    const renderCvData = {
      cv: {
        name: personalInfo.name || "Your Name",
        location: personalInfo.location || "",
        email: personalInfo.email || "",
        phone: personalInfo.phone || "",
        website: personalInfo.github || "", // Mapping github to website for simplicity
        social_networks: [
          ...(personalInfo.linkedin ? [{ network: "LinkedIn", username: personalInfo.linkedin.split('/').pop() || personalInfo.linkedin }] : []),
          ...(personalInfo.github ? [{ network: "GitHub", username: personalInfo.github.split('/').pop() || personalInfo.github }] : [])
        ],
        sections: {
          experience: experiences.filter(exp => exp.title || exp.company).map(exp => ({
            company: exp.company,
            position: exp.title,
            highlights: exp.description ? exp.description.split('\n').filter(line => line.trim().startsWith('•')).map(line => line.replace('•', '').trim()) : []
          })),
          projects: projects.filter(proj => proj.title).map(proj => ({
            name: proj.title,
            date: "Recent", // Fallback, could add to form later
            highlights: proj.description ? proj.description.split('\n').filter(line => line.trim().startsWith('•')).map(line => line.replace('•', '').trim()) : []
          })),
          education: education.filter(edu => edu.school).map(edu => ({
            institution: edu.school,
            area: edu.degree,
            date: edu.year
          }))
        }
      }
    };

    // Convert to YAML string
    const yamlString = yaml.dump(renderCvData, { indent: 2 });
    
    // Create a Blob and trigger download
    const blob = new Blob([yamlString], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${personalInfo.name.replace(/\s+/g, '_') || "resume"}_RenderCV.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Exported RenderCV YAML",
      description: "You can now use this file with the RenderCV command line tool.",
    });
  };

  const handleExport = () => {
    toast({
      title: "Generating PDF",
      description: `Downloading your ${templates.find(t => t.id === selectedTemplate)?.name} PDF...`,
    });
    
    // Generate a basic PDF using jsPDF (Frontend only approach)
    const doc = new jsPDF();
    let yPos = 20;
    const margin = 20;
    
    // Title/Name
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(personalInfo.name || "Your Name", margin, yPos);
    yPos += 10;
    
    // Contact Info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const contactInfo = [
      personalInfo.email,
      personalInfo.phone,
      personalInfo.location,
      personalInfo.linkedin,
      personalInfo.github
    ].filter(Boolean).join(" | ");
    
    doc.text(contactInfo, margin, yPos);
    yPos += 15;
    
    // Experience Section
    if (experiences.some(exp => exp.title || exp.company)) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("EXPERIENCE", margin, yPos);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos + 2, 190, yPos + 2);
      yPos += 8;
      
      experiences.forEach(exp => {
        if (exp.title || exp.company) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(`${exp.title}${exp.company ? ` at ${exp.company}` : ''}`, margin, yPos);
          yPos += 6;
          
          if (exp.description) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(exp.description, 170);
            doc.text(lines, margin, yPos);
            yPos += (lines.length * 5) + 5;
          }
        }
      });
    }
    
    // Projects Section
    if (projects.some(proj => proj.title)) {
      yPos += 5;
      if (yPos > 260) { doc.addPage(); yPos = 20; }
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PROJECTS", margin, yPos);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos + 2, 190, yPos + 2);
      yPos += 8;
      
      projects.forEach(proj => {
        if (proj.title) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(proj.title, margin, yPos);
          yPos += 6;
          
          if (proj.description) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(proj.description, 170);
            doc.text(lines, margin, yPos);
            yPos += (lines.length * 5) + 5;
          }
        }
      });
    }

    // Education Section
    if (education.some(edu => edu.school)) {
      yPos += 5;
      if (yPos > 260) { doc.addPage(); yPos = 20; }
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("EDUCATION", margin, yPos);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos + 2, 190, yPos + 2);
      yPos += 8;
      
      education.forEach(edu => {
        if (edu.school) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(`${edu.school}${edu.degree ? ` - ${edu.degree}` : ''}`, margin, yPos);
          if (edu.year) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(edu.year, 190, yPos, { align: "right" });
          }
          yPos += 8;
        }
      });
    }
    
    // Save the PDF
    doc.save(`${(personalInfo.name || "Resume").replace(/\s+/g, '_')}_Resume.pdf`);

    setTimeout(() => {
      setShowPreview(false);
      setStep(1); // Reset back to start or whatever makes sense
    }, 1500);
  };

  const templates = [
    { id: 'modern', name: 'Classic (SB2nov)', desc: 'Clean, robust parsing', img: '/images/template-1.png' },
    { id: 'minimalist', name: 'Academic (Classic)', desc: 'Focus on research', img: '/images/template-2.png' },
    { id: 'professional', name: 'Tech (Modern)', desc: 'For tech companies', img: '/images/template-3.png' },
    { id: 'creative', name: 'Engineering', desc: 'Detailed layout', img: '/images/template-4.png' },
    { id: 'bold', name: 'Executive', desc: 'Clear typography', img: '/images/template-5.png' },
    { id: 'simple', name: 'Standard', desc: 'Simple & safe', img: '/images/template-6.png' },
    { id: 'clean', name: 'Minimal', desc: 'Lots of whitespace', img: '/images/template-7.png' }
  ];

  if (showPreview) {
    return (
      <div className="min-h-screen flex flex-col pb-20 bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">
          <div className="max-w-4xl w-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold font-mono tracking-tight">Final Preview</h1>
                <p className="text-muted-foreground mt-2">Here is how your generated resume looks.</p>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setShowPreview(false)}>Edit Details</Button>
                <Button variant="secondary" className="gap-2" onClick={handleExportYAML}>
                  <FileText className="w-4 h-4" /> Export RenderCV YAML
                </Button>
                <Button className="gap-2" onClick={handleExport}>
                  <Download className="w-4 h-4" /> Download PDF
                </Button>
              </div>
            </div>

            <Card className="glass-panel border-white/10 p-8 flex flex-col items-center justify-center min-h-[600px] relative overflow-hidden bg-white/5">
                <img 
                  src={templates.find(t => t.id === selectedTemplate)?.img} 
                  alt="Resume Preview" 
                  className="max-h-[800px] w-auto object-contain rounded shadow-2xl border border-white/20"
                />
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold font-mono tracking-tight">Resume Builder</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground hidden md:flex">
              <span className={step >= 1 ? "text-primary font-medium" : ""}>1. Setup & Template</span>
              <span className="w-8 h-px bg-border"></span>
              <span className={step >= 2 ? "text-primary font-medium" : ""}>2. Content & AI</span>
              <span className="w-8 h-px bg-border"></span>
              <span className={step >= 3 ? "text-primary font-medium" : ""}>3. Preview</span>
            </div>
          </div>

          {step === 1 && (
            <div className="grid lg:grid-cols-2 gap-8">
              <Card className="glass-panel floating-card border-white/10 h-fit">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Your Existing Resume (Optional)
                  </CardTitle>
                  <CardDescription>
                    Upload your current resume or paste a link. Leave blank to build from scratch.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div 
                    className="border-2 border-dashed border-white/20 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-background/50 hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={() => document.getElementById('resume-upload')?.click()}
                  >
                    <input type="file" id="resume-upload" className="hidden" accept=".pdf,.docx,.txt" />
                    <div className="p-3 bg-primary/20 rounded-full mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <p className="font-medium mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT (Max 5MB)</p>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Resume Link</Label>
                    <Input 
                      placeholder="https://linkedin.com/in/yourprofile or Portfolio link" 
                      className="bg-background/50 border-white/10"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-panel floating-card border-white/10">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <TargetIcon className="w-5 h-5 text-primary" />
                    Target Job Description
                  </CardTitle>
                  <CardDescription>
                    Paste the job description here to optimize your resume keywords.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Textarea 
                      id="jd" 
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste the full job description here..." 
                      className="min-h-[300px] font-mono text-sm bg-background/50 border-white/10"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2">
                <Button className="w-full gap-2 h-14 text-lg font-medium shadow-lg hover:shadow-primary/20 transition-all" onClick={simulateAnalysis} disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Analyzing & Setting up Builder...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Start Building Resume
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step >= 2 && (
             <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
               <div className="lg:col-span-2 space-y-6">
                 <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-background/50 border border-white/5">
                      <TabsTrigger value="info">Info</TabsTrigger>
                      <TabsTrigger value="experience">Experience</TabsTrigger>
                      <TabsTrigger value="projects">Projects</TabsTrigger>
                      <TabsTrigger value="education">Education</TabsTrigger>
                    </TabsList>
                    
                    {/* Info Tab */}
                    <TabsContent value="info" className="mt-6 space-y-6">
                      <Card className="glass-panel floating-card border-white/10">
                        <CardHeader>
                          <CardTitle className="text-lg">Personal Information</CardTitle>
                          <CardDescription>Basic contact details for the header of your resume.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Full Name</Label>
                              <Input 
                                placeholder="e.g. John Doe" 
                                className="bg-background/50" 
                                value={personalInfo.name}
                                onChange={(e) => setPersonalInfo({...personalInfo, name: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Email</Label>
                              <Input 
                                placeholder="john@example.com" 
                                type="email" 
                                className="bg-background/50" 
                                value={personalInfo.email}
                                onChange={(e) => setPersonalInfo({...personalInfo, email: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Phone</Label>
                              <Input 
                                placeholder="(555) 123-4567" 
                                className="bg-background/50" 
                                value={personalInfo.phone}
                                onChange={(e) => setPersonalInfo({...personalInfo, phone: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Location</Label>
                              <Input 
                                placeholder="San Francisco, CA" 
                                className="bg-background/50" 
                                value={personalInfo.location}
                                onChange={(e) => setPersonalInfo({...personalInfo, location: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>LinkedIn</Label>
                              <Input 
                                placeholder="linkedin.com/in/johndoe" 
                                className="bg-background/50" 
                                value={personalInfo.linkedin}
                                onChange={(e) => setPersonalInfo({...personalInfo, linkedin: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>GitHub / Portfolio</Label>
                              <Input 
                                placeholder="github.com/johndoe" 
                                className="bg-background/50" 
                                value={personalInfo.github}
                                onChange={(e) => setPersonalInfo({...personalInfo, github: e.target.value})}
                              />
                            </div>
                          </div>
                        </CardContent>
                        <div className="p-4 border-t border-white/10 flex justify-end">
                           <Button onClick={() => setActiveTab("experience")}>Next: Add Experience</Button>
                        </div>
                      </Card>
                    </TabsContent>

                    {/* Experience Tab */}
                    <TabsContent value="experience" className="mt-6 space-y-6">
                      <Card className="glass-panel floating-card border-white/10">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">Work Experience</CardTitle>
                            <CardDescription>Add your roles and let AI optimize the bullet points.</CardDescription>
                          </div>
                          <div>
                            <input 
                              type="file" 
                              accept=".pdf,.docx" 
                              className="hidden" 
                              ref={fileInputRef}
                              onChange={handleFileUpload}
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload className="w-4 h-4" /> Import from PDF
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          
                          {experiences.map((exp) => (
                            <div key={exp.id} className="space-y-4 p-4 rounded-xl bg-background/50 border border-white/5 relative group transition-all">
                              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeExperience(exp.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>

                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Job Title</Label>
                                  <Input 
                                    value={exp.title} 
                                    onChange={(e) => updateExperience(exp.id, 'title', e.target.value)}
                                    placeholder="e.g. Software Engineer"
                                    className="bg-background/50" 
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Company</Label>
                                  <Input 
                                    value={exp.company} 
                                    onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                                    placeholder="e.g. Tech Corp"
                                    className="bg-background/50" 
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>Description & Achievements</Label>
                                </div>
                                <GhostTextarea 
                                  value={exp.description}
                                  onChange={(val: string) => updateExperience(exp.id, 'description', val)}
                                  placeholder="• Describe your responsibilities and achievements..."
                                  suggestion={dynamicSuggestion}
                                />
                              </div>
                            </div>
                          ))}

                          <Button 
                            variant="outline" 
                            className="w-full border-dashed gap-2"
                            onClick={addExperience}
                          >
                            <Plus className="w-4 h-4" /> Add Experience
                          </Button>
                        </CardContent>
                        <div className="p-4 border-t border-white/10 flex justify-between">
                           <Button variant="outline" onClick={() => setActiveTab("info")}>Back</Button>
                           <Button onClick={() => setActiveTab("projects")}>Next: Add Projects</Button>
                        </div>
                      </Card>
                    </TabsContent>

                    {/* Projects Tab */}
                    <TabsContent value="projects" className="mt-6 space-y-6">
                       <Card className="glass-panel floating-card border-white/10">
                        <CardHeader>
                          <CardTitle className="text-lg">Projects</CardTitle>
                          <CardDescription>Showcase your portfolio pieces relevant to the job.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {projects.map((proj) => (
                            <div key={proj.id} className="space-y-4 p-4 rounded-xl bg-background/50 border border-white/5 relative group transition-all">
                              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeProject(proj.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Project Title</Label>
                                  <Input 
                                    value={proj.title} 
                                    onChange={(e) => updateProject(proj.id, 'title', e.target.value)}
                                    placeholder="e.g. E-Commerce Platform"
                                    className="bg-background/50" 
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Technologies Used</Label>
                                  <Input 
                                    value={proj.technologies} 
                                    onChange={(e) => updateProject(proj.id, 'technologies', e.target.value)}
                                    placeholder="e.g. React, Node.js, MongoDB"
                                    className="bg-background/50" 
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Description</Label>
                                <GhostTextarea 
                                  value={proj.description}
                                  onChange={(val: string) => updateProject(proj.id, 'description', val)}
                                  placeholder="• Explain what you built and the impact..."
                                  suggestion={dynamicSuggestion}
                                />
                              </div>
                            </div>
                          ))}
                          <Button variant="outline" className="w-full border-dashed gap-2" onClick={addProject}>
                            <Plus className="w-4 h-4" /> Add Project
                          </Button>
                        </CardContent>
                        <div className="p-4 border-t border-white/10 flex justify-between">
                           <Button variant="outline" onClick={() => setActiveTab("experience")}>Back</Button>
                           <Button onClick={() => setActiveTab("education")}>Next: Add Education</Button>
                        </div>
                       </Card>
                    </TabsContent>

                    {/* Education Tab */}
                    <TabsContent value="education" className="mt-6 space-y-6">
                      <Card className="glass-panel floating-card border-white/10">
                        <CardHeader>
                          <CardTitle className="text-lg">Education</CardTitle>
                          <CardDescription>List your degrees and certifications.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {education.map((edu) => (
                            <div key={edu.id} className="space-y-4 p-4 rounded-xl bg-background/50 border border-white/5 relative group transition-all">
                              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeEducation(edu.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>School / University</Label>
                                  <Input 
                                    value={edu.school} 
                                    onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                                    placeholder="e.g. University of Technology"
                                    className="bg-background/50" 
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Degree / Certificate</Label>
                                  <Input 
                                    value={edu.degree} 
                                    onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                                    placeholder="e.g. B.S. Computer Science"
                                    className="bg-background/50" 
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Year / Timeline</Label>
                                  <Input 
                                    value={edu.year} 
                                    onChange={(e) => updateEducation(edu.id, 'year', e.target.value)}
                                    placeholder="e.g. 2018 - 2022"
                                    className="bg-background/50" 
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          <Button variant="outline" className="w-full border-dashed gap-2" onClick={addEducation}>
                            <Plus className="w-4 h-4" /> Add Education
                          </Button>
                        </CardContent>
                        <div className="p-4 border-t border-white/10 flex justify-between">
                           <Button variant="outline" onClick={() => setActiveTab("projects")}>Back</Button>
                           <Button onClick={handlePreview} className="gap-2">
                             <CheckCircle2 className="w-4 h-4" /> Finish & Preview
                           </Button>
                        </div>
                      </Card>
                    </TabsContent>
                 </Tabs>
               </div>

               <div className="space-y-6">
                 {/* Template Preview Sidebar */}
                 <Card className="glass-panel floating-card border-white/10">
                   <CardHeader className="pb-4">
                     <CardTitle className="text-sm font-medium flex items-center justify-between">
                       Template Selection
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                     <div className="aspect-[3/4] w-full rounded-xl overflow-hidden border border-white/10 bg-white/5 relative">
                        <img 
                          src={templates.find(t => t.id === selectedTemplate)?.img} 
                          alt="Template Preview" 
                          className="w-full h-full object-cover transition-opacity duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end p-4">
                          <span className="font-medium text-sm drop-shadow-md">
                            {templates.find(t => t.id === selectedTemplate)?.name} Preview
                          </span>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                       {templates.map(t => (
                         <div 
                           key={t.id}
                           onClick={() => setSelectedTemplate(t.id)}
                           className={`p-2 rounded-lg border cursor-pointer transition-all text-center ${
                             selectedTemplate === t.id 
                               ? 'border-primary bg-primary/20 text-primary' 
                               : 'border-white/10 hover:border-white/30 bg-background/50 text-muted-foreground'
                           }`}
                         >
                           <span className="font-medium text-[10px] sm:text-xs block truncate" title={t.name}>{t.name}</span>
                         </div>
                       ))}
                     </div>
                   </CardContent>
                 </Card>

                 {/* JD Context Sidebar */}
                 <Card className="glass-panel floating-card border-white/10 sticky top-24">
                   <CardHeader className="pb-4">
                     <CardTitle className="text-sm font-medium flex items-center justify-between">
                       JD Match Status
                       <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Score: {matchScore}%</span>
                     </CardTitle>
                     <Progress value={matchScore} className="h-1.5 mt-2 bg-secondary" />
                   </CardHeader>
                   <CardContent className="space-y-6">
                     <div>
                       <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Required Skills</h4>
                       <div className="flex flex-wrap gap-2">
                         {requiredSkills.map(skill => (
                           <Badge 
                             key={skill.name}
                             variant={skill.present ? "default" : "outline"} 
                             className={
                               skill.present 
                                 ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" 
                                 : "border-red-500/30 text-red-400 bg-red-500/5"
                             }
                           >
                             {skill.name} 
                             {skill.present 
                               ? <CheckCircle2 className="w-3 h-3 ml-1" /> 
                               : <AlertCircle className="w-3 h-3 ml-1" />
                             }
                           </Badge>
                         ))}
                       </div>
                     </div>

                     <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-start gap-2">
                          <BotIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <div className="text-sm text-muted-foreground leading-relaxed">
                            <strong className="text-foreground block mb-1">AI Suggestion:</strong>
                            {missingSkills.length === 0 ? (
                              <span>Great job! You have matched all the key skills from the job description.</span>
                            ) : (
                              <span>
                                You are missing <span className="text-primary">{missingSkills.slice(0, 2).map(s => s.name).join(" and ")}</span>. 
                                Consider adding a project or experience bullet point mentioning these to boost your score.
                              </span>
                            )}
                          </div>
                        </div>
                     </div>

                     <div className="pt-4 border-t border-white/10 hidden">
                        <Button className="w-full gap-2" onClick={handlePreview}>
                          <Download className="w-4 h-4" />
                          Preview & Export PDF
                        </Button>
                     </div>
                   </CardContent>
                 </Card>
               </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
}

function BotIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
}

function Badge({ children, className, variant = "default" }: any) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>{children}</span>
}