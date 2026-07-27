import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, AlertTriangle, Video, VideoOff, Zap } from 'lucide-react';

export default function SimpleDrowsinessDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(false);
  const [closedDuration, setClosedDuration] = useState(0);
  const [alertActive, setAlertActive] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [brightness, setBrightness] = useState(0);
  
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const closedStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBlinkTimeRef = useRef<number>(0);

  // Play alarm sound
  const playAlarm = () => {
    try {
      if (!audioContextRef.current) {
        // @ts-ignore - AudioContext constructor works without arguments
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing alarm:', error);
    }
  };

  // Simple brightness-based eye detection
  const detectEyesClosed = (canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    const width = video.videoWidth;
    const height = video.videoHeight;
    
    if (width === 0 || height === 0) return false;

    canvas.width = width;
    canvas.height = height;
    
    // Draw video frame
    ctx.drawImage(video, 0, 0, width, height);
    
    // Sample eye regions (approximate positions for frontal face)
    // Left eye: ~20-35% width, ~35-45% height
    // Right eye: ~65-80% width, ~35-45% height
    
    const eyeRegions = [
      { x: width * 0.25, y: height * 0.40, w: width * 0.15, h: height * 0.08 }, // Left eye
      { x: width * 0.60, y: height * 0.40, w: width * 0.15, h: height * 0.08 }, // Right eye
    ];
    
    let totalBrightness = 0;
    let sampleCount = 0;
    
    eyeRegions.forEach(region => {
      const imageData = ctx.getImageData(region.x, region.y, region.w, region.h);
      const pixels = imageData.data;
      
      // Calculate average brightness
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
        sampleCount++;
      }
      
      // Draw region indicators
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.w, region.h);
    });
    
    const avgBrightness = totalBrightness / sampleCount;
    setBrightness(Math.round(avgBrightness));
    
    // Adaptive threshold based on brightness
    // Lower brightness = eyes likely closed (eyelids darker than open eyes)
    const baseThreshold = 100;
    const threshold = avgBrightness < baseThreshold;
    
    return threshold;
  };

  // Main detection loop
  const detectLoop = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      try {
        const isClosed = detectEyesClosed(canvas, video);
        
        let duration = 0;
        const now = Date.now();
        
        if (isClosed) {
          if (!eyesClosed) {
            closedStartTimeRef.current = now;
            setEyesClosed(true);
            
            // Count blinks (quick close/open cycles)
            if (now - lastBlinkTimeRef.current > 500) {
              setBlinkCount(prev => prev + 1);
              lastBlinkTimeRef.current = now;
            }
          }
          
          duration = (now - closedStartTimeRef.current) / 1000;
          setClosedDuration(duration);
          
          // Trigger alarm if eyes closed for more than 2 seconds
          if (duration > 2 && !alertActive) {
            setAlertActive(true);
            playAlarm();
            
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200, 100, 200]);
            }
          }
        } else {
          if (eyesClosed) {
            setEyesClosed(false);
            setClosedDuration(0);
            setAlertActive(false);
          }
        }
        
        // Draw status
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = isClosed ? '#ff0000' : '#00ff00';
          ctx.font = 'bold 20px monospace';
          ctx.fillText(isClosed ? '👁️ EYES CLOSED' : '👁️ EYES OPEN', 10, 30);
          ctx.font = '16px monospace';
          ctx.fillText(`Brightness: ${brightness}`, 10, 55);
          ctx.fillText(`Blinks: ${blinkCount}`, 10, 75);
          if (isClosed && duration > 0) {
            ctx.fillText(`Duration: ${duration.toFixed(1)}s`, 10, 95);
          }
        }
      } catch (error) {
        console.error('Detection error:', error);
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(detectLoop);
  };

  // Start detection
  const startDetection = async () => {
    setIsLoading(true);
    
    try {
      console.log('📹 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        },
        audio: false,
      });
      
      console.log('✅ Camera access granted');
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsActive(true);
          setIsLoading(false);
          setBlinkCount(0);
          console.log('✅ Detection started!');
          detectLoop();
        };
      }
    } catch (error) {
      console.error('❌ Error starting detection:', error);
      setIsLoading(false);
      
      let errorMessage = 'Unable to start detection. ';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += 'Camera permission denied. Please allow camera access.';
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'No camera found. Please connect a webcam.';
        } else if (error.name === 'NotReadableError') {
          errorMessage += 'Camera is already in use by another application.';
        } else {
          errorMessage += error.message;
        }
      }
      
      alert('Error: ' + errorMessage);
    }
  };

  // Stop detection
  const stopDetection = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    setIsActive(false);
    setEyesClosed(false);
    setClosedDuration(0);
    setAlertActive(false);
    setBlinkCount(0);
  };

  useEffect(() => {
    return () => {
      stopDetection();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-500" />
                Fast Drowsiness Detector
              </CardTitle>
              <CardDescription>
                Instant startup • No AI model download • Privacy-first
              </CardDescription>
            </div>
            <Badge variant={alertActive ? 'destructive' : isActive ? 'default' : 'secondary'}>
              {alertActive ? '🚨 ALERT' : isActive ? '✅ ACTIVE' : '⭕ IDLE'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Alert Banner */}
          {alertActive && (
            <Alert variant="destructive" className="animate-pulse border-2">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-lg">⚠️ DROWSINESS DETECTED!</AlertTitle>
              <AlertDescription className="text-base">
                Your eyes have been closed for {closedDuration.toFixed(1)} seconds. 
                <strong> Please take a break!</strong>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Video Display */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
              muted
              style={{ display: isActive ? 'block' : 'none' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain"
            />
            
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center text-gray-400">
                  <VideoOff className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-lg">Camera inactive</p>
                  <p className="text-sm mt-2">Click "Start Detection" to begin</p>
                </div>
              </div>
            )}
            
            {/* Status Overlay */}
            {isActive && (
              <div className="absolute bottom-4 left-4 space-y-2">
                <Badge variant={eyesClosed ? 'destructive' : 'default'} className="flex items-center gap-2 text-lg px-4 py-2">
                  {eyesClosed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  {eyesClosed ? 'Eyes Closed' : 'Eyes Open'}
                </Badge>
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="flex gap-4 justify-center">
            {!isActive ? (
              <Button
                onClick={startDetection}
                disabled={isLoading}
                size="lg"
                className="flex items-center gap-2 text-lg px-8 py-6"
              >
                <Video className="w-5 h-5" />
                {isLoading ? 'Starting...' : 'Start Detection'}
              </Button>
            ) : (
              <Button
                onClick={stopDetection}
                variant="destructive"
                size="lg"
                className="flex items-center gap-2 text-lg px-8 py-6"
              >
                <VideoOff className="w-5 h-5" />
                Stop Detection
              </Button>
            )}
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <div className="text-sm font-semibold text-blue-400 mb-1">Status</div>
              <div className="text-2xl font-bold">
                {isActive ? (eyesClosed ? '😴 Drowsy' : '😊 Alert') : '⏸️ Paused'}
              </div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
              <div className="text-sm font-semibold text-purple-400 mb-1">Blink Count</div>
              <div className="text-2xl font-bold">{blinkCount}</div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <div className="text-sm font-semibold text-orange-400 mb-1">Closed Duration</div>
              <div className="text-2xl font-bold">{closedDuration.toFixed(1)}s</div>
            </Card>
          </div>
          
          {/* Info */}
          <Alert>
            <Zap className="h-4 w-4" />
            <AlertTitle>Lightning Fast Detection</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                <li><strong>Instant startup</strong> - No AI model download required</li>
                <li><strong>Works offline</strong> - All processing in your browser</li>
                <li><strong>Privacy-first</strong> - Video never leaves your device</li>
                <li><strong>Real-time alerts</strong> - Alarm triggers after 2 seconds of closed eyes</li>
              </ul>
            </AlertDescription>
          </Alert>
          
          <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/50">
            <AlertTitle>💡 Tips for best results</AlertTitle>
            <AlertDescription className="text-sm">
              • Ensure good lighting on your face
              • Position camera at eye level
              • Keep face centered in frame
              • Avoid wearing sunglasses
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
