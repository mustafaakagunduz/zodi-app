import { useState } from 'react';
import { useStore } from '../store.jsx';
import Sheet from './Sheet.jsx';

const GAMES = [
  { type: 'thisthat', name: 'Bu mu, Şu mu?', about: '5 soruyu ikiniz de yanıtlayın; cevaplar sonra açılır.' },
  { type: 'xox', name: 'XOX', about: 'Üçlüyü ilk yapan kazanır. Oyunu başlatan X olur.' },
];

// Oyunda sıra bende mi?
export const waitingForMe = (game) =>
  !game.finished && (game.type === 'xox' ? game.myTurn : !game.mine);

function ThisOrThat({ game, partnerName, busy, onAnswer }) {
  const [answers, setAnswers] = useState(() => game.questions.map(() => null));

  if (game.finished) {
    const same = game.mine.filter((a, i) => a === game.partner[i]).length;
    return (
      <>
        <p><b>{game.questions.length} sorudan {same} tanesinde ortaksınız 🎯</b></p>
        <ul className="results">
          {game.questions.map((options, i) => (
            <li key={options.join()} className={game.mine[i] === game.partner[i] ? 'same' : ''}>
              <span>Sen: {options[game.mine[i]]}</span>
              <span>{partnerName}: {options[game.partner[i]]}</span>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (game.mine) return <p className="muted">Cevapların gönderildi. {partnerName} bekleniyor…</p>;

  return (
    <>
      {game.partnerDone && <p className="muted">{partnerName} yanıtladı, sıra sende!</p>}
      {game.questions.map((options, i) => (
        <div key={options.join()} className="pair">
          {options.map((option, choice) => (
            <button
              key={option}
              type="button"
              aria-pressed={answers[i] === choice}
              onClick={() => setAnswers((list) => list.with(i, choice))}
            >
              {option}
            </button>
          ))}
        </div>
      ))}
      <button type="button" className="button" disabled={busy || answers.includes(null)} onClick={() => onAnswer(answers)}>
        Cevaplarımı gönder
      </button>
    </>
  );
}

function Xox({ game, partnerName, busy, onMove }) {
  const status = {
    win: 'Kazandın 🎉',
    lose: `${partnerName} kazandı.`,
    draw: 'Berabere.',
  }[game.result] ?? (game.myTurn ? 'Sıra sende' : `${partnerName} oynuyor…`);

  return (
    <>
      <p><b>{status}</b> <small>Senin işaretin: {game.symbol}</small></p>
      <div className="board">
        {game.board.map((cell, i) => (
          <button
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            type="button"
            aria-label={`${i + 1}. kare ${cell ?? 'boş'}`}
            disabled={busy || !game.myTurn || Boolean(cell)}
            onClick={() => onMove(i)}
          >
            {cell}
          </button>
        ))}
      </div>
    </>
  );
}

export default function GameSheet({ chat, onClose }) {
  const { act, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(() => chat.games.find(waitingForMe)?.type ?? null);
  const selected = GAMES.find((g) => g.type === open);
  const game = chat.games.find((g) => g.type === open);

  const run = async (event, payload) => {
    setBusy(true);
    try {
      await act(event, { chatId: chat.id, ...payload });
    } catch (error) {
      toast({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  if (!selected) {
    return (
      <Sheet title="Oyunlar" onClose={onClose}>
        <ul className="options">
          {GAMES.map((g) => {
            const current = chat.games.find((c) => c.type === g.type);
            return (
              <li key={g.type}>
                <button type="button" onClick={() => setOpen(g.type)}>
                  <b>{g.name}</b> {current && waitingForMe(current) && <span className="tag">Sıra sende</span>}
                  <br /><small>{g.about}</small>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    );
  }

  const props = { game, partnerName: chat.partner.name, busy };
  return (
    <Sheet title={selected.name} onClose={onClose}>
      <button type="button" className="back" onClick={() => setOpen(null)}>‹ Tüm oyunlar</button>
      {!game && <p className="muted">{selected.about}</p>}
      {game?.type === 'thisthat' && (
        <ThisOrThat key={game.questions.join()} {...props} onAnswer={(answers) => run('game:answer', { answers })} />
      )}
      {game?.type === 'xox' && <Xox {...props} onMove={(cell) => run('game:move', { cell })} />}
      {(!game || game.finished) && (
        <button type="button" className="button" disabled={busy} onClick={() => run('game:start', { type: open })}>
          {game ? 'Yeni oyun' : 'Oyunu başlat'}
        </button>
      )}
      {game && !game.finished && (
        <button type="button" className="button ghost" disabled={busy} onClick={() => run('game:close', { type: open })}>
          Oyunu iptal et
        </button>
      )}
    </Sheet>
  );
}
