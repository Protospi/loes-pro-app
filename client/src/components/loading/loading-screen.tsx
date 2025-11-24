'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { useLanguage } from '../../lib/LanguageContext'
import { useDynamicTranslations } from '../../lib/DynamicTranslations'

const loadingMessages = [
  '> Loading ...',
  '> Translating application ...',
  '> Translating prompt',
  '> Translating knowledge base',
  '> Reviewing everything ...'
]

export default function LoadingScreen() {
  const [, setLocation] = useLocation()
  const { setDetectedLanguage } = useLanguage()
  const { updateTranslations } = useDynamicTranslations()
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [completedMessages, setCompletedMessages] = useState<string[]>([])
  const [showCursor, setShowCursor] = useState(true)
  const [translationsCompleted, setTranslationsCompleted] = useState(false)

  useEffect(() => {
    // Cursor blinking effect
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 500)

    return () => clearInterval(cursorInterval)
  }, [])

  // Handle translation process in the background
  useEffect(() => {
    const processTranslations = async () => {
      const pendingLanguageInput = localStorage.getItem('pendingLanguageInput')
      
      // PRIORITY 1: If user just selected a new language, use that (ignore cache)
      if (pendingLanguageInput) {
        console.log('🆕 New language selection detected, will update cache with new language')
        
        try {
          // Detect and translate the new language
          const { getSessionId } = await import('../../lib/sessionManager')
          const sessionId = getSessionId()
        
        const response = await fetch('/api/language-detection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
          },
          body: JSON.stringify({ text: pendingLanguageInput }),
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`)
        }
        
        const data = await response.json()
        // console.log('Language detection result:', data)
        
        if (data.language) {
          // Update the application's language based on the detection
          setDetectedLanguage(data.language)
          
          // console.log('Language detected and interface translated:', data.language)
          // console.log('Translated content received:', data.translatedContent)
          
          // Update translations dynamically without page reload
          if (data.translatedContent) {
            await updateTranslations(data.translatedContent)
          }
          
          // Step 2: Create a user with the detected language
          try {
            const createUserResponse = await fetch('/api/users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                language: data.language,
                name: 'website-visitor'
              }),
            })
            
            if (createUserResponse.ok) {
              const userData = await createUserResponse.json()
              console.log('User created with ID:', userData._id)
              
              // Store the userId in localStorage for later use in messages
              if (userData._id) {
                localStorage.setItem('userId', userData._id)
                console.log('User ID saved to localStorage:', userData._id)
              }
            }
          } catch (userError) {
            console.error('Error creating user:', userError)
            // Continue even if user creation fails
          }
        }
        } catch (apiError) {
          console.error('Language detection API error:', apiError)
          // Use a fallback language (English) if detection fails
          setDetectedLanguage('English')
          
          // Try to create a user with default language
          try {
            const createUserResponse = await fetch('/api/users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                language: 'English',
                name: 'website-visitor'
              }),
            })
            
            if (createUserResponse.ok) {
              const userData = await createUserResponse.json()
              if (userData._id) {
                localStorage.setItem('userId', userData._id)
              }
            }
          } catch (fallbackError) {
            console.error('Error creating fallback user:', fallbackError)
          }
        }
        
        // Clean up the pending input after processing
        localStorage.removeItem('pendingLanguageInput')
        setTranslationsCompleted(true)
        return
      }
      
      // PRIORITY 2: No new language selection, try to use cached translation
      try {
        const { getSessionId } = await import('../../lib/sessionManager')
        const sessionId = getSessionId()
        
        const cacheResponse = await fetch('/api/translations/cache', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
          },
        })
        
        if (cacheResponse.ok) {
          const cachedData = await cacheResponse.json()
          console.log('✅ Using cached translation from loading screen:', cachedData.language)
          
          // Update language and translations from cache
          setDetectedLanguage(cachedData.language)
          if (cachedData.translatedContent) {
            await updateTranslations(cachedData.translatedContent)
          }
          setTranslationsCompleted(true)
          return
        }
      } catch (cacheError) {
        console.log('No cached translation found, using default')
      }
      
      // PRIORITY 3: No pending input and no cache, use English default
      console.log('Using default English language')
      setDetectedLanguage('English')
      setTranslationsCompleted(true)
    }

    processTranslations()
  }, [])

  useEffect(() => {
    if (currentMessageIndex >= loadingMessages.length) {
      return
    }

    const currentMessage = loadingMessages[currentMessageIndex]
    const isLastMessage = currentMessageIndex === loadingMessages.length - 1
    
    if (typedText.length < currentMessage.length) {
      // Continue typing current message
      const typingTimer = setTimeout(() => {
        setTypedText(currentMessage.slice(0, typedText.length + 1))
      }, 50) // Typing speed - 50ms per character

      return () => clearTimeout(typingTimer)
    } else {
      // Message completed
      if (isLastMessage) {
        // If it's the last message and translations are complete, navigate
        if (translationsCompleted) {
          setTimeout(() => {
            setLocation('/chat')
          }, 500)
        }
        // Otherwise, just stay on this message with cursor blinking
      } else {
        // Move to next message after delay
        const nextMessageTimer = setTimeout(() => {
          setCompletedMessages(prev => [...prev, currentMessage])
          setCurrentMessageIndex(prev => prev + 1)
          setTypedText('')
        }, 800) // Pause between messages

        return () => clearTimeout(nextMessageTimer)
      }
    }
  }, [currentMessageIndex, typedText, translationsCompleted, setLocation])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col"
      transition={{ duration: 0.3 }}
    >
      {/* Top half - Terminal in the center */}
      <div className="h-1/2 flex items-center justify-center">
        <div className="font-mono text-white text-lg leading-relaxed">
          {/* Completed messages */}
          {completedMessages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-2"
            >
              {message}
            </motion.div>
          ))}
          
          {/* Currently typing message */}
          {currentMessageIndex < loadingMessages.length && (
            <div className="mb-2">
              {typedText}
              <span className={`ml-1 ${showCursor ? 'opacity-100' : 'opacity-0'}`}>
                _
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom half - Video in the center */}
      <div className="h-1/2 flex items-center justify-center">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-96 h-96 object-contain"
        >
          <source src="/chip-veo.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </motion.div>
  )
}
