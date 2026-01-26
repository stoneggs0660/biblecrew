import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateUserPassword } from '../firebaseSync';

export default function ChangePassword({ user }) {
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // 로그인 정보가 없으면 로그인 페이지로 이동
    if (!user || !user.uid) {
      navigate('/login');
    }
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pwd1 || !pwd2) {
      alert('새 비밀번호를 입력해 주세요.');
      return;
    }
    if (pwd1 !== pwd2) {
      alert('비밀번호가 서로 일치하지 않습니다.');
      return;
    }
    try {
      await updateUserPassword(user.uid, pwd1);
      alert('비밀번호가 변경되었습니다.');
      navigate('/home');
    } catch (err) {
      alert(err && err.message ? err.message : '비밀번호 변경에 실패했습니다.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#E3F2FD', padding: 20 }}>
      <h2 style={{ textAlign: 'center', color: '#1565C0', marginBottom: 16 }}>비밀번호 변경</h2>
      <p style={{ textAlign: 'center', marginBottom: 24 }}>
        보안을 위해 새 비밀번호를 설정해야 로그인할 수 있습니다.
      </p>
      <form
        onSubmit={handleSubmit}
        style={{ maxWidth: 400, margin: '0 auto', background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>새 비밀번호</label>
          <input
            type="password"
            value={pwd1}
            onChange={(e) => setPwd1(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>새 비밀번호 확인</label>
          <input
            type="password"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <button
          type="submit"
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 6,
            border: 'none',
            background: '#1565C0',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          비밀번호 변경 완료
        </button>
      </form>
    </div>
  );
}
