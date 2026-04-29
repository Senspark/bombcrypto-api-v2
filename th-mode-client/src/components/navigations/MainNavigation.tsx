import {Navigate, Route, Routes} from 'react-router-dom';
import LeaderBoardPage from "../leaderboard/LeaderBoardPage";
import PvpLeaderBoardPage from "../pvp-leaderboard/PvpLeaderBoardPage";

const MainNavigation = () => {
    return (
        <Routes>
            <Route path={'/'}>
                <Route index element={
                    <LeaderBoardPage/>
                }/>
                <Route path="pvp" element={<PvpLeaderBoardPage/>}/>
                <Route path="*" element={<Navigate to={'/'} replace/>}/>
            </Route>
        </Routes>
    );
};

export default MainNavigation;
