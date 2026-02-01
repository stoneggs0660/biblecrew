import React from 'react';

export default function LastMonthResultModal({ visible, onClose, data, year, month }) {
  if (!visible) return null;
  const gold = (data && data.gold) || {};
  const silver = (data && data.silver) || {};
  const bronze = (data && data.bronze) || {};

  const renderList = (bucket) => {
    const arr = Object.values(bucket || {});
    if (!arr.length) return '없음';
    return arr.map((info, idx) => (
      <span key={idx}>
        {info.name || '이름없음'}{info.crew ? `(${info.crew})` : ''}{idx < arr.length - 1 ? ', ' : ''}
      </span>
    ));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: 20,
          borderRadius: 10,
          width: '90%',
          maxWidth: 420,
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          {year}년 {month}월 지난달 명예의 전당
        </h3>
        <div style={{ marginBottom: 8 }}>
          <strong>🥇 금메달:</strong> {renderList(gold)}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>🥈 은메달:</strong> {renderList(silver)}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>🥉 동메달:</strong> {renderList(bronze)}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: 'none',
            background: '#1D3557',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
