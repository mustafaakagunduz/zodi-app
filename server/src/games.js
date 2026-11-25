// İki kişilik oyunların kuralları. Veritabanından bağımsız, saf işlevler.
import { randomInt } from 'node:crypto';
import { THIS_OR_THAT } from './data/constants.js';
import { AppError } from './errors.js';

export const GAMES = { thisthat: 'Bu mu, Şu mu?', xox: 'XOX' };
const ROUNDS = 5;
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
];

export function newGame(type, starterId, partnerId) {
  if (type === 'xox') {
    return { players: [starterId, partnerId], board: Array(9).fill(null), turn: starterId, winner: null };
  }
  const pool = THIS_OR_THAT.map((_, index) => index);
  const questions = Array.from({ length: ROUNDS }, () => pool.splice(randomInt(pool.length), 1)[0]);
  return { questions: questions.map((i) => THIS_OR_THAT[i]), answers: {} };
}

export function answer(state, userId, answers) {
  const valid =
    Array.isArray(answers) &&
    answers.length === state.questions.length &&
    answers.every((a) => a === 0 || a === 1);
  if (!valid) throw new AppError('Tüm soruları yanıtlamalısın.');
  if (state.answers[userId]) throw new AppError('Cevaplarını zaten gönderdin.');
  return { ...state, answers: { ...state.answers, [userId]: answers } };
}

export function move(state, userId, cell) {
  if (state.winner) throw new AppError('Oyun bitti.');
  if (state.turn !== userId) throw new AppError('Sıra sende değil.');
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || state.board[cell]) {
    throw new AppError('Bu kare seçilemez.');
  }
  const board = state.board.with(cell, userId);
  const won = LINES.some((line) => line.every((i) => board[i] === userId));
  const winner = won ? userId : board.every(Boolean) ? 'draw' : null;
  return { ...state, board, winner, turn: state.players.find((id) => id !== userId) };
}

export const isFinished = (type, state) =>
  type === 'xox' ? Boolean(state.winner) : Object.keys(state.answers).length === 2;

// Oyuncunun görebileceği hal: karşı tarafın cevapları iki taraf da yanıtlayınca açılır.
export function viewGame(type, state, userId, partnerId) {
  const finished = isFinished(type, state);
  if (type === 'xox') {
    return {
      type,
      finished,
      board: state.board.map((id) => id && (id === state.players[0] ? 'X' : 'O')),
      symbol: state.players[0] === userId ? 'X' : 'O',
      myTurn: !finished && state.turn === userId,
      result: !state.winner ? null : state.winner === 'draw' ? 'draw' : state.winner === userId ? 'win' : 'lose',
    };
  }
  return {
    type,
    finished,
    questions: state.questions,
    mine: state.answers[userId] ?? null,
    partnerDone: Boolean(state.answers[partnerId]),
    partner: finished ? state.answers[partnerId] : null,
  };
}
