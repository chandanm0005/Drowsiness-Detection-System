import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, AlertTriangle, Video, VideoOff } from 'lucide-react';

export default function DrowsinessDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [eyesClosed, setEyesClosed] = useState(false);
  const [closedDuration, setClosedDuration] = useState(0);
  const [alertActive, setAlertActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'active' | 'alert' | 'error'>('idle');
  const [fps, setFps] = useState(0);
  
  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const closedStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const eyesClosedRef = useRef<boolean>(false); // Track with ref for accurate timing
  const hasAlertedRef = useRef<boolean>(false); // Track if alarm already played

  // Calculate Eye Aspect Ratio (EAR)
  const calculateEAR = (eye: number[][]) => {
    const vertical1 = Math.hypot(eye[1][0] - eye[5][0], eye[1][1] - eye[5][1]);
    const vertical2 = Math.hypot(eye[2][0] - eye[4][0], eye[2][1] - eye[4][1]);
    const horizontal = Math.hypot(eye[0][0] - eye[3][0], eye[0][1] - eye[3][1]);
    return (vertical1 + vertical2) / (2.0 * horizontal);
  };

  // Play alarm sound
  const playAlarm = () => {
    try {
      if (!audioContextRef.current) {
        // @ts-ignore - AudioContext constructor works without arguments
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      const ctx = audioContextRef.current;
      
      // Play 3 beeps in succession for better alertness
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          oscillator.frequency.value = 1000; // Higher pitch for urgency
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.5, ctx.currentTime); // Louder
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.3);
        }, i * 400); // 400ms between beeps
      }
      
      console.log('🚨 DROWSINESS ALARM TRIGGERED!');
    } catch (error) {
      console.error('Error playing alarm:', error);
    }
  };

  // Initialize camera and model
  const startDetection = async () => {
    setIsLoading(true);
    setStatus('idle');
    setLoadingStep('Initializing...');
    
    try {
      console.log('🚀 Starting detection...');
      
      // Initialize TensorFlow backend
      setLoadingStep('Loading TensorFlow.js...');
      console.log('📦 Loading TensorFlow.js...');
      await tf.ready();
      console.log('✅ TensorFlow.js ready');
      
      // Load face landmarks model with TFLite runtime (much faster!)
      setLoadingStep('Loading face detection model...');
      console.log('🤖 Loading face detection model...');
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshTfjsModelConfig = {
        runtime: 'tfjs',
        maxFaces: 1,
        refineLandmarks: false, // Faster without refinement
      };
      
      detectorRef.current = await faceLandmarksDetection.createDetector(model, detectorConfig);
      console.log('✅ Model loaded successfully');
      
      // Get webcam stream
      setLoadingStep('Requesting camera access...');
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
          setLoadingStep('Starting detection...');
          console.log('▶️ Starting video playback...');
          videoRef.current?.play();
          setIsActive(true);
          setStatus('active');
          setIsLoading(false);
          setLoadingStep('');
          console.log('✅ Detection started successfully!');
          detectLoop();
        };
      }
    } catch (error) {
      console.error('❌ Error starting detection:', error);
      setStatus('error');
      setIsLoading(false);
      setLoadingStep('');
      
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

  // Main detection loop
  const detectLoop = async () => {
    const startTime = performance.now();
    
    if (!detectorRef.current || !videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    try {
      // Detect faces
      const faces = await detectorRef.current.estimateFaces(video);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (faces.length > 0) {
        const face = faces[0];
        const keypoints = face.keypoints;
        
        // Extract eye landmarks (MediaPipe Face Mesh indices)
        // Left eye: 33, 160, 158, 133, 153, 144
        // Right eye: 362, 385, 387, 263, 373, 380
        const leftEye = [
          keypoints[33], keypoints[160], keypoints[158],
          keypoints[133], keypoints[153], keypoints[144]
        ].map(p => [p.x, p.y]);
        
        const rightEye = [
          keypoints[362], keypoints[385], keypoints[387],
          keypoints[263], keypoints[373], keypoints[380]
        ].map(p => [p.x, p.y]);
        
        // Calculate EAR for both eyes
        const leftEAR = calculateEAR(leftEye);
        const rightEAR = calculateEAR(rightEye);
        const avgEAR = (leftEAR + rightEAR) / 2;
        
        // Draw face landmarks
        ctx.fillStyle = '#00ff00';
        keypoints.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI);
          ctx.fill();
        });
        
        // Draw eyes specifically
        ctx.strokeStyle = avgEAR < 0.21 ? '#ff0000' : '#00ff00';
        ctx.lineWidth = 2;
        
        // Draw left eye
        ctx.beginPath();
        leftEye.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point[0], point[1]);
          else ctx.lineTo(point[0], point[1]);
        });
        ctx.closePath();
        ctx.stroke();
        
        // Draw right eye
        ctx.beginPath();
        rightEye.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point[0], point[1]);
          else ctx.lineTo(point[0], point[1]);
        });
        ctx.closePath();
        ctx.stroke();
        
        // Check if eyes are closed (EAR threshold: 0.21 - balanced)
        const threshold = 0.21;
        const isClosed = avgEAR < threshold;
        
        // Always log for debugging
        console.log(`👁️ EAR: ${avgEAR.toFixed(3)} | Closed: ${isClosed} | Timer: ${eyesClosedRef.current}`);
        
        let duration = 0;
        if (isClosed) {
          // Eyes are currently closed
          if (!eyesClosedRef.current) {
            // Just closed - start timer
            closedStartTimeRef.current = Date.now();
            eyesClosedRef.current = true;
            hasAlertedRef.current = false;
            setEyesClosed(true);
            setAlertActive(false);
            console.log('🔴 Eyes JUST CLOSED - Starting timer at:', new Date().toLocaleTimeString());
          }
          
          // Calculate duration
          duration = (Date.now() - closedStartTimeRef.current) / 1000;
          setClosedDuration(duration);
          
          // Log every 0.5 seconds
          if (duration % 0.5 < 0.1) {
            console.log(`⏱️ Eyes closed for ${duration.toFixed(1)}s`);
          }
          
          // Trigger alarm ONCE if eyes closed for 5+ seconds
          if (duration >= 5 && !hasAlertedRef.current) {
            hasAlertedRef.current = true;
            setAlertActive(true);
            playAlarm();
            console.log('🚨 ALARM TRIGGERED! Eyes closed for', duration.toFixed(1), 'seconds');
            
            // Vibrate if supported
            if ('vibrate' in navigator) {
              navigator.vibrate([500, 100, 500, 100, 500]);
            }
          }
        } else {
          // Eyes are currently open
          if (eyesClosedRef.current) {
            // Just opened - reset timer
            console.log(`🟢 Eyes OPENED after ${closedDuration.toFixed(1)}s`);
            eyesClosedRef.current = false;
            hasAlertedRef.current = false;
            closedStartTimeRef.current = 0;
            setEyesClosed(false);
            setClosedDuration(0);
            setAlertActive(false);
          }
        }
        
        // Display EAR value
        ctx.fillStyle = isClosed ? '#ff0000' : '#00ff00';
        ctx.font = '16px monospace';
        ctx.fillText(`EAR: ${avgEAR.toFixed(3)} (threshold: 0.21)`, 10, 30);
        ctx.fillText(`Left: ${leftEAR.toFixed(3)} | Right: ${rightEAR.toFixed(3)}`, 10, 50);
        ctx.fillText(`Status: ${isClosed ? '🔴 EYES CLOSED' : '🟢 EYES OPEN'}`, 10, 70);
        if (isClosed) {
          ctx.fillStyle = duration >= 5 ? '#ff0000' : '#ffaa00';
          ctx.font = 'bold 20px monospace';
          ctx.fillText(`⏱️ Duration: ${duration.toFixed(1)}s`, 10, 100);
          if (duration >= 5) {
            ctx.fillText(`🚨 ALARM TRIGGERED!`, 10, 130);
          }
        }
      }
      
      // Calculate FPS
      const endTime = performance.now();
      const currentFps = 1000 / (endTime - startTime);
      setFps(Math.round(currentFps));
      
    } catch (error) {
      console.error('Detection error:', error);
    }
    
    // Continue loop
    animationFrameRef.current = requestAnimationFrame(detectLoop);
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
    
    // Reset all refs
    eyesClosedRef.current = false;
    hasAlertedRef.current = false;
    closedStartTimeRef.current = 0;
    
    setIsActive(false);
    setEyesClosed(false);
    setClosedDuration(0);
    setAlertActive(false);
    setStatus('idle');
    
    console.log('⏹️ Detection stopped');
  };

  // Cleanup on unmount
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
                <Eye className="w-6 h-6" />
                Drowsiness Detection System
              </CardTitle>
              <CardDescription>
                AI-powered eye tracking to detect drowsiness and alert you
              </CardDescription>
            </div>
            <Badge variant={
              status === 'alert' ? 'destructive' : 
              status === 'active' ? 'default' : 
              status === 'error' ? 'destructive' : 
              'secondary'
            }>
              {status === 'alert' ? 'ALERT' : 
               status === 'active' ? 'ACTIVE' : 
               status === 'error' ? 'ERROR' : 
               'IDLE'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Alert Banner */}
          {alertActive && (
            <Alert variant="destructive" className="animate-pulse">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>⚠️ DROWSINESS DETECTED!</AlertTitle>
              <AlertDescription>
                Your eyes have been closed for {closedDuration.toFixed(1)} seconds. 
                <strong> Wake up! Please take a break or rest!</strong>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Video Display */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-auto"
              width="640"
              height="480"
              autoPlay
              playsInline
              muted
              style={{ display: isActive ? 'block' : 'none' }}
            />
            <canvas
              ref={canvasRef}
              width="640"
              height="480"
              className="absolute top-0 left-0 w-full h-full"
            />
            
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center text-gray-400">
                  <VideoOff className="w-16 h-16 mx-auto mb-4" />
                  <p>Camera inactive</p>
                </div>
              </div>
            )}
            
            {/* Status Overlay */}
            {isActive && (
              <div className="absolute top-4 right-4 space-y-2">
                <Badge variant="secondary" className="flex items-center gap-2">
                  {eyesClosed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {eyesClosed ? 'Eyes Closed' : 'Eyes Open'}
                </Badge>
                <Badge variant="outline" className="block text-center">
                  {fps} FPS
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
                className="flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                {isLoading ? loadingStep || 'Starting...' : 'Start Detection'}
              </Button>
            ) : (
              <Button
                onClick={stopDetection}
                variant="destructive"
                size="lg"
                className="flex items-center gap-2"
              >
                <VideoOff className="w-4 h-4" />
                Stop Detection
              </Button>
            )}
          </div>
          
          {/* Loading Progress */}
          {isLoading && (
            <Alert className="bg-blue-500/10 border-blue-500/50">
              <AlertTitle>Loading...</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>{loadingStep}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    This may take 10-30 seconds on first load...
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <Card className="p-4">
              <div className="font-semibold mb-1">Detection Status</div>
              <div className="text-muted-foreground">
                {status === 'idle' && 'Not started'}
                {status === 'active' && '✅ Monitoring'}
                {status === 'alert' && '🚨 Alert triggered'}
                {status === 'error' && '❌ Error occurred'}
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="font-semibold mb-1">Eyes Closed Duration</div>
              <div className="text-muted-foreground">
                {closedDuration.toFixed(1)}s
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="font-semibold mb-1">Alert Threshold</div>
              <div className="text-muted-foreground">
                5.0 seconds
              </div>
            </Card>
          </div>
          
          {/* Instructions */}
          <Alert>
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Click "Start Detection" to enable your webcam</li>
                <li>The system will track your eye movements in real-time</li>
                <li><strong>If your eyes are closed for 5 seconds continuously, an alarm will sound</strong></li>
                <li>The alarm plays ONCE - it won't repeat until you open and close your eyes again</li>
                <li>Perfect for detecting drowsiness while driving or studying</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
