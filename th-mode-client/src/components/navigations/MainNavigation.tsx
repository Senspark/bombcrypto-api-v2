import {Navigate, NavLink, Route, Routes} from 'react-router-dom';
import LeaderBoardPage from "../leaderboard/LeaderBoardPage";
import WatchPage from "../watch/WatchPage";
import FavoritesPage from "../watch/FavoritesPage";
import PayRockPage from "../payrock/PayRockPage";
import './MainNavigation.css';
import {CrownOutlined, EyeOutlined} from "@ant-design/icons";

const NavBar = () => (
    <nav className="main-nav">
        <NavLink to="/" end className={({isActive}) => `main-nav-link${isActive ? ' active' : ''}`}>
            <CrownOutlined/> <span>Leaderboard</span>
        </NavLink>
        <NavLink to="/watch" className={({isActive}) => `main-nav-link${isActive ? ' active' : ''}`}>
            <EyeOutlined/> <span>Watch Wallet</span>
        </NavLink>
        <NavLink to="/pay-rock" className={({isActive}) => `main-nav-link${isActive ? ' active' : ''}`}>
            <img src="/tiny_rock.png" alt="" className="main-nav-icon"/> <span>Claim Quartz</span>
        </NavLink>
    </nav>
);

const MainNavigation = () => {
    return (
        <>
            <NavBar/>
            <Routes>
                <Route path={'/'} index element={<LeaderBoardPage/>}/>
                <Route path={'/watch'} element={<FavoritesPage/>}/>
                <Route path={'/watch/:wallet'} element={<WatchPage/>}/>
                <Route path={'/pay-rock'} element={<PayRockPage/>}/>
                <Route path="*" element={<Navigate to={'/'} replace/>}/>
            </Routes>
        </>
    );
};

export default MainNavigation;
