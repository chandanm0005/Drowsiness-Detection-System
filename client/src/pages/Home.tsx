import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Eye, Shield, Zap, AlertTriangle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-20 px-4 ai-gradient-bg">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium mb-4">
          <Eye className="w-4 h-4" />
          <span>AI-Powered Drowsiness Detection</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          Stay <span className="ai-gradient-text">Awake</span>.<br/> Stay <span className="ai-gradient-text">Safe</span>.
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Advanced AI-powered eye tracking system that detects drowsiness in real-time and alerts you before it's too late. Perfect for drivers, students, and professionals.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Link href="/drowsiness">
            <Button size="lg" className="gap-2 h-14 px-8 text-lg w-full sm:w-auto shadow-[0_0_40px_rgba(139,92,246,0.3)]">
              <Eye className="w-5 h-5" />
              Start Detection
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-32 max-w-5xl mx-auto px-4 w-full">
        <FeatureCard 
          icon={<Eye className="w-8 h-8 text-primary" />}
          title="Real-Time Eye Tracking"
          description="Advanced AI detects when your eyes are closed using 478 facial landmarks and MediaPipe technology."
        />
        <FeatureCard 
          icon={<AlertTriangle className="w-8 h-8 text-yellow-400" />}
          title="5-Second Alert System"
          description="Loud alarm triggers after 5 seconds of closed eyes to wake you up before danger strikes."
        />
        <FeatureCard 
          icon={<Shield className="w-8 h-8 text-green-400" />}
          title="Privacy-First Design"
          description="All processing happens in your browser. Your video never leaves your device."
        />
      </div>
    </div>
  );
}

function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center gap-4 hover:border-primary/30 transition-all duration-300 floating-card">
      <div className="p-3 bg-background/50 rounded-xl border border-white/5">
        {icon}
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
