import { verifyAdminPassword } from '../firebaseSync';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [pwd, setPwd] = useState('');
  const navigate = useNavigate();
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await verifyAdminPassword(pwd);
      if (res && res.ok) {
        navigate('/admin');
      }
    } catch (err) {
      alert(err && err.message ? err.message : '관리자 비밀번호가 올바르지 않습니다.');
    }
  }
  return (
    <div style={{ minHeight: '100vh', background: '#E8F5E9', padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ color: '#1B5E20', marginBottom: 24, fontSize: 26 }}>관리자 로그인</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 420, margin: '0 auto' }}>
        <input
          placeholder="비밀번호"
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          style={{ width: '100%', padding: 16, borderRadius: 10, border: '1px solid #ccc', marginBottom: 14, fontSize: 18 }}
        />
        <button type="submit"
          style={{ width: '100%', padding: 16, borderRadius: 10, background: '#1B5E20', color: '#fff', border: 'none', fontSize: 18 }}>
          로그인
        </button>
        <div style={{ marginTop: 20 }}>
          <button type="button"
            onClick={() => navigate('/home')}
            style={{ background: 'none', border: 'none', color: '#1565C0', cursor: 'pointer', fontSize: 14 }}
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </form>
    </div>
  );
}