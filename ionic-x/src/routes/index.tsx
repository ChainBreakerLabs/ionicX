import {createBrowserRouter} from 'react-router-dom'
import Dashboard from "../screens/DashboardScreen";
import ExternalLive from "../screens/ExternalLiveScreen";
import LyricsStudioScreen from "../screens/LyricsStudioScreen";
import SermonCoverScreen from "../screens/SermonCoverScreen";

const Routes = createBrowserRouter([
    {
        path: '/',
        element: <Dashboard/>
    },
    {
        path: '/letras',
        element: <LyricsStudioScreen/>
    },
    {
        path: '/portadas',
        element: <SermonCoverScreen/>
    },
    {
        path: '/external-live',
        element: <ExternalLive/>
    }
])

export default Routes
