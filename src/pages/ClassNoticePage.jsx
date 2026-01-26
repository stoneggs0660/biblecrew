import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToClassNotices, saveClassNotice } from '../firebaseSync';
import { CREWS, getCrewLabel } from '../utils/crewConfig';

export default function ClassNoticePage() {
  const navigate = useNavigate();
  const [allNotices, setAllNotices] = useState({});
  const [crewName, setCrewName] = useState('초급반');
  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = subscribeToClassNotices((data) => setAllNotices(data || {}));
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const currentNotice = useMemo(() => {
    return (allNotices && allNotices[crewName]) || null;
  }, [allNotices, crewName]);

  useEffect(() => {
    const n = currentNotice || {};
    setEnabled(!!n.enabled);
    setTitle((n.title || '').toString());
    setContent((n.content || '').toString());
    setSavedMsg('');
    setErrorMsg('');
  }, [currentNotice, crewName]);

  const version = useMemo(() => {
    const v = currentNotice?.version;
    return parseInt(v || '0', 10) || 0;
  }, [currentNotice]);

  const updatedAtText = useMemo(() => {
    const ts = currentNotice?.updatedAt;
    if (!ts) return '';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }, [currentNotice]);

  async function handleSave() {
    setSaving(true);
    setSavedMsg('');
    setErrorMsg('');
    try {
      await saveClassNotice(crewName, {
        enabled,
        title: (title || '').trim(),
        content: (content || '').toString(),
      });
      setSavedMsg('저장되었습니다. (버전이 증가했습니다)');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch (e) {
      console.error('반 안내 저장 오류', e);
      setErrorMsg('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8F9FF',
        padding: '22px 16px 40px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              border: 'none',
              background: '#111827',
              color: '#fff',
              borderRadius: 12,
              padding: '10px 14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← 관리자 홈
          </button>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#111827' }}>반 안내팝업 관리</div>
          <div style={{ width: 90 }} />
        </div>

        <div
          style={{
            marginTop: 16,
            background: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 800, color: '#111827' }}>반 선택</div>
              <select
                value={crewName}
                onChange={(e) => setCrewName(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.18)',
                  fontWeight: 700,
                }}
              >
                {CREWS.map((c) => (
                  <option key={c.crewKey} value={c.crewKey}>
                    {getCrewLabel(c.crewKey)}
                  </option>
                ))}
              </select>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontWeight: 800,
                color: '#111827',
              }}
            >
              안내팝업 사용
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
            </label>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: '#6B7280' }}>현재 버전: <b>{version}</b></div>
            {updatedAtText && <div style={{ fontSize: 13, color: '#6B7280' }}>최근 저장: {updatedAtText}</div>}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>제목 (선택)</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 초급반 안내"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.18)',
                fontSize: 15,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>안내 내용</div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="반에 들어오면 표시할 안내 내용을 입력하세요.\n(사용자가 화면을 터치하면 닫힙니다.)"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.18)',
                fontSize: 15,
                lineHeight: 1.6,
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                border: 'none',
                background: saving ? '#9CA3AF' : '#2563EB',
                color: '#fff',
                borderRadius: 12,
                padding: '12px 14px',
                fontWeight: 900,
                cursor: saving ? 'not-allowed' : 'pointer',
                minWidth: 120,
              }}
            >
              {saving ? '저장중...' : '저장'}
            </button>
            {savedMsg && <div style={{ fontSize: 14, color: '#065F46', fontWeight: 800 }}>{savedMsg}</div>}
            {errorMsg && <div style={{ fontSize: 14, color: '#B91C1C', fontWeight: 800 }}>{errorMsg}</div>}
          </div>

          <div
            style={{
              marginTop: 18,
              background: '#F3F4F6',
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              color: '#374151',
              lineHeight: 1.6,
            }}
          >
            <b>동작 규칙</b>
            <div>• 안내팝업이 <b>ON</b>이고, 내용이 있으며, 사용자가 아직 해당 <b>버전</b>을 보지 않았을 때만 뜹니다.</div>
            <div>• 저장할 때마다 버전이 자동으로 +1 됩니다. (기존 사용자에게도 다시 노출됩니다)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
