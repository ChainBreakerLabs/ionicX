import { RouterProvider } from 'react-router-dom'
import Routes from "./routes";
import AnimatedLogo from "./components/AnimatedLogo";
import {useState} from "react";
import { LiveProvider } from "./contexts/LiveContext";
import { BackendProvider } from "./contexts/BackendContext";

function App() {
    const [showLogo, setShowLogo] = useState(true)

    const handleAnimationComplete = () => {
        setShowLogo(false)
    }

  return (
    <div className="min-h-screen w-full">
        {showLogo ? (
            <AnimatedLogo onAnimationComplete={handleAnimationComplete} />
            ):(
        <BackendProvider>
            <LiveProvider>
                <RouterProvider router={Routes}/>
            </LiveProvider>
        </BackendProvider>
        )}
    </div>
  )
}

export default App
