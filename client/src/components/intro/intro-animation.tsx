'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'wouter'
import { useLanguage } from '../../lib/LanguageContext'
import { useDynamicTranslations } from '../../lib/DynamicTranslations'
import ForceGraph from './force-graph'
import { Mic } from 'lucide-react'

// These arrays are used for the typing animation effect only
// The actual displayed text will come from translations
const messages = [
  "Welcome to my portfolio",
  "Bienvenido a mi portafolio",
  "Bem-vindo ao meu portfolio",
  "欢迎来到我的简历",
  "Willkommen in meinem Portfolio",
  "Bienvenue dans mon portfolio",
  "こんにちは、私のポートフォリオです",
]

const placeholders = [
  "Type or speak your language",
  "Escribe o habla tu idioma",
  "Digite ou fale seu idioma",
  "输入或说出您的语言",
  "Tippen oder sprechen Sie Ihre Sprache",
  "Tapez ou parlez votre langue", 
  "言語を入力または話してください",
]

export default function IntroAnimation() {
  const { t } = useTranslation()
  const { setDetectedLanguage } = useLanguage()
  const { updateTranslations } = useDynamicTranslations()
  const [, setLocation] = useLocation()
  const [isExiting, setIsExiting] = useState(false)
  const [typedMessage, setTypedMessage] = useState('')
  const [typedPlaceholder, setTypedPlaceholder] = useState('')
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [showElements, setShowElements] = useState(false)
  const [isTyping, setIsTyping] = useState(true)
  const [isDeletingMessage, setIsDeletingMessage] = useState(false)
  const [isPulsing, setIsPulsing] = useState(true)
  const [userInput, setUserInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let typingTimer: NodeJS.Timeout
    
    if (isTyping && !isDeletingMessage) {
      if (typedMessage.length < messages[currentMessageIndex].length) {
        typingTimer = setTimeout(() => {
          setTypedMessage(messages[currentMessageIndex].slice(0, typedMessage.length + 1))
          // Type placeholder at the same rate as the message
          setTypedPlaceholder(placeholders[currentMessageIndex].slice(0, typedMessage.length + 1))
        }, 50)
      } else {
        // When message is complete, ensure placeholder is also complete
        setTypedPlaceholder(placeholders[currentMessageIndex])
        typingTimer = setTimeout(() => {
          setIsDeletingMessage(true)
        }, 1000)
      }
    } else if (isDeletingMessage) {
      if (typedMessage.length > 0) {
        typingTimer = setTimeout(() => {
          const newLength = typedMessage.length - 1
          setTypedMessage(typedMessage.slice(0, newLength))
          setTypedPlaceholder(placeholders[currentMessageIndex].slice(0, newLength))
        }, 30)
      } else {
        setIsDeletingMessage(false)
        if (currentMessageIndex === 0 && !showElements) {
          setShowElements(true)
        }
        setCurrentMessageIndex((prev) => (prev + 1) % messages.length)
        setTypedPlaceholder('')
      }
    }

    return () => clearTimeout(typingTimer)
  }, [typedMessage, currentMessageIndex, isTyping, isDeletingMessage, showElements])

  useEffect(() => {
    if (showElements) {
      const pulseInterval = setInterval(() => {
        setIsPulsing(prev => !prev);
      }, 2000);
      
      return () => clearInterval(pulseInterval);
    }
  }, [showElements]);

  // Cleanup effect for recording
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
      }
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      detectLanguage()
    }
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value)
  }
  
  const detectLanguage = async () => {
    if (!userInput.trim()) {
      alert(t('intro.noLanguageInput', 'Please provide a language input by typing or speaking before starting the portfolio.'))
      return
    }
    
    // Store the user input for the loading page to process
    localStorage.setItem('pendingLanguageInput', userInput)
    
    // Start exit animation immediately
    setIsExiting(true)
    
    // Navigate to loading page immediately
    setTimeout(() => {
      setLocation('/loading')
    }, 500)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        await sendAudioToServer(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)

      // Set 10 second timeout
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording()
          alert(t('intro.recordingTooLong', 'Recording too long! Please try again and say your language in less than 10 seconds.'))
        }
      }, 10000)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert(t('intro.recordingError', 'Failed to record audio. Please try again.'))
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
        recordingTimeoutRef.current = null
      }
    }
  }

  const sendAudioToServer = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to transcribe audio')
      }

      const data = await response.json()
      
      // Set the transcribed text in the input field
      if (data.transcribedText && data.transcribedText.trim()) {
        setUserInput(data.transcribedText.trim())
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      alert(t('intro.recordingError', 'Failed to record audio. Please try again.'))
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleMicPress = (e: React.PointerEvent) => {
    e.preventDefault()
    startRecording()
  }

  const handleMicRelease = (e: React.PointerEvent) => {
    e.preventDefault()
    stopRecording()
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white z-50 flex items-center justify-center"
      transition={{ duration: 0.5 }}
    >
      {/* Add the force graph as a background */}
      <div className="absolute inset-0 z-0">
        <ForceGraph />
      </div>
      
      <div className="text-center max-w-2xl px-4 z-10">
        <motion.div
          className="text-3xl font-bold text-gray-800 mb-24 h-20 flex items-center justify-center"
        >
          <span className="border-r-2 border-gray-800 pr-1" 
            style={{ borderRightColor: isTyping ? undefined : 'transparent' }}>
            {typedMessage}
          </span>
        </motion.div>

        {showElements && (
          <>
            {/* Input Field with microphone button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-28 flex items-center gap-2 justify-center"
            >
              <input
                type="text"
                placeholder={typedPlaceholder}
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
                value={userInput}
                disabled={isRecording || isTranscribing}
                className="w-64 px-4 py-2 rounded-lg border-2 border-gray-300 focus:border-gray-500 focus:outline-none bg-black text-white placeholder-white::placeholder disabled:opacity-50"
              />
              <button
                onPointerDown={handleMicPress}
                onPointerUp={handleMicRelease}
                onPointerLeave={handleMicRelease}
                disabled={isTranscribing}
                className={`flex items-center justify-center rounded-lg border-2 transition-all duration-200 overflow-hidden relative ${
                  isRecording 
                    ? 'bg-red-500 border-red-600 animate-pulse' 
                    : isTranscribing
                    ? 'bg-gray-400 border-gray-500'
                    : 'bg-black border-gray-300 hover:border-gray-500 active:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ height: '42px', width: '42px' }}
              >
                <motion.div
                  animate={{
                    color: isRecording || isTranscribing ? '#ffffff' : (isPulsing ? '#f87171' : '#ffffff'),
                  }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                >
                  <Mic size={20} />
                </motion.div>
              </button>
            </motion.div>

            {/* Start Button - Enhanced photorealistic button with pulsing effect */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={detectLanguage}
              className="relative w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-black shadow-lg hover:shadow-xl transition-all duration-300 group"
              style={{
                boxShadow: '0 10px 25px rgba(0,0,0,0.3), inset 0 2px 3px rgba(255,255,255,0.2), inset 0 -3px 6px rgba(0,0,0,0.4)'
              }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Outer ring highlight */}
              <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-gray-600 to-gray-900 opacity-80"></div>
              
              {/* Inner circle with gradient */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center"
                style={{
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)'
                }}>
                {/* Center dot with pulsing effect */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-inner">
                  <motion.div 
                    className="w-4 h-4 rounded-full"
                    animate={{
                      backgroundColor: isPulsing ? '#f87171' : '#ffffff',
                      boxShadow: isPulsing 
                        ? '0 0 15px 2px rgba(239,68,68,0.7), 0 0 5px 1px rgba(239,68,68,0.9) inset' 
                        : '0 0 5px 1px rgba(255,255,255,0.7), 0 0 2px 1px rgba(255,255,255,0.9) inset'
                    }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                  ></motion.div>
                </div>
              </div>
              
              {/* Highlight effect - top reflection */}
              <div className="absolute top-0.5 left-2 right-2 h-1/4 bg-gradient-to-br from-white to-transparent opacity-30 rounded-t-full"></div>
              
              {/* Side reflection */}
              <div className="absolute top-1/4 bottom-1/4 right-1 w-1 bg-gradient-to-t from-transparent via-white to-transparent opacity-20 rounded-full"></div>
              
              {/* Bottom shadow */}
              <div className="absolute bottom-1 left-3 right-3 h-1 bg-black opacity-30 rounded-full blur-sm"></div>
              
              {/* Hover effect - subtle glow */}
              <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-40 bg-red-500 blur-md transition-opacity duration-300"></div>
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  )
} 