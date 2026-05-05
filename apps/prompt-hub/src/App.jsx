import { Routes, Route } from 'react-router-dom'
import Hub from './components/Hub'
import Studio from './components/Studio'
import MinimalStudio from './components/MinimalStudio'
import KlingStudio from './components/KlingStudio'
import PromptChat from './components/PromptChat'
import ImageStudio from './components/ImageStudio'
import VideoStudio from './components/VideoStudio'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/studio" element={<Studio />} />
      <Route path="/studio2" element={<MinimalStudio />} />
      <Route path="/studio2/chat/:sessionId" element={<PromptChat />} />
      <Route path="/studio3" element={<KlingStudio />} />
      <Route path="/studio3/chat/:sessionId" element={<PromptChat />} />
      <Route path="/image" element={<ImageStudio />} />
      <Route path="/video" element={<VideoStudio />} />
    </Routes>
  )
}
