import { loginOrRegisterUser } from './firebaseSync';
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import HallOfFame from './pages/HallOfFame.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ClassNoticePage from './pages/ClassNoticePage.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import CrewPage from './components/CrewPage.jsx';
import Records from './pages/Records.jsx';
import BibleReadingPage from './pages/BibleReadingPage.jsx';
import CrewMembers from './pages/CrewMembers.jsx';

export default function RootApp() {
  const [user, setUser] = useState(null);

  // 앱 시작 시 로컬스토리지에서 사용자 정보 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem('biblecrew_user');
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

      async function handleLogin(name, password) {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    const user = await loginOrRegisterUser(trimmed, password || '');
    const stored = { uid: user.uid, name: user.name || trimmed, crew: user.crew || null, mustChangePassword: !!user.mustChangePassword };
    setUser(stored);
    localStorage.setItem('biblecrew_user', JSON.stringify(stored));
    return stored;
  }


  return (
    <HashRouter>
      <Routes>
        <Route path='/admin-login' element={<AdminLogin />} />
        <Route path='/' element={<Login onLogin={handleLogin} />} />
        <Route path='/login' element={<Login onLogin={handleLogin} />} />
        <Route path='/home' element={<Home user={user} />} />
        <Route path='/crew-members' element={<CrewMembers user={user} />} />
        <Route path='/change-password' element={<ChangePassword user={user} />} />
        <Route path='/고급반' element={<CrewPage crewName='고급반' user={user} />} />
        <Route path='/중급반' element={<CrewPage crewName='중급반' user={user} />} />
        <Route path='/초급반구약A' element={<CrewPage crewName='초급반(구약A)' user={user} />} />
        <Route path='/초급반구약B' element={<CrewPage crewName='초급반(구약B)' user={user} />} />
        {/* 기존 신약 초급반 키 유지 */}
        <Route path='/초급반신약' element={<CrewPage crewName='초급반' user={user} />} />
        {/* 하위 호환: 기존 '/초급반' 경로 */}
        <Route path='/초급반' element={<CrewPage crewName='초급반' user={user} />} />
        <Route path='/명예의전당' element={<HallOfFame />} />
        <Route path='/records' element={<Records user={user} />} />
        <Route path='/성경읽기' element={<BibleReadingPage user={user} />} />
        <Route path='/admin' element={<AdminPage />} />
        <Route path='/admin/class-notice' element={<ClassNoticePage />} />
      </Routes>
    </HashRouter>
  );
}
