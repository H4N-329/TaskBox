'use client';
import {useEffect, useRef, useState} from 'react';
import type {KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent} from 'react';
import {findGroupDropTarget, groupPosition} from '../lib/group-drag';
import type {GroupDropTarget} from '../lib/group-drag';

type Group = {id: string; x: number; y: number};
type Options = {layout: string; groups: Group[]; disabled: boolean; onReorder: (id: string, index: number) => void; onPosition: (id: string, x: number, y: number) => void};
type View = {id: string; left: number; top: number; width: number; x: number; y: number; free: boolean; target: GroupDropTarget | null};
type Session = {id: string; pointerId: number; handle: HTMLElement; startX: number; startY: number; lastX: number; lastY: number;
  left: number; top: number; width: number; groupX: number; groupY: number; boardLeft: number; boardTop: number;
  scrollLeft: number; scrollTop: number; layout: string; active: boolean; frame: number | null; view: View | null};

export function useGroupDrag(options: Options) {
  const boardRef = useRef<HTMLElement>(null), session = useRef<Session | null>(null), current = useRef(options);
  const [view, setView] = useState<View | null>(null);
  current.current = options;

  function cancel() {
    const drag = session.current;
    session.current = null;
    if (drag?.frame != null) cancelAnimationFrame(drag.frame);
    if (drag?.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
    document.documentElement.classList.remove('group-drag-active');
    setView(null);
  }
  function update(x: number, y: number) {
    const drag = session.current, board = boardRef.current;
    if (!drag || !board) return;
    drag.lastX = x; drag.lastY = y;
    if (!drag.active && Math.hypot(x - drag.startX, y - drag.startY) < 6) return;
    drag.active = true;
    document.documentElement.classList.add('group-drag-active');
    const bounds = board.getBoundingClientRect();
    const position = groupPosition(drag.groupX, drag.groupY, x - drag.startX + drag.boardLeft - bounds.left + board.scrollLeft - drag.scrollLeft,
      y - drag.startY + drag.boardTop - bounds.top + board.scrollTop - drag.scrollTop);
    const inside = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    const rects = Array.from(board.querySelectorAll<HTMLElement>('[data-group-id]')).map(element => {
      const rect = element.getBoundingClientRect();
      return {id: element.dataset.groupId!, left: rect.left, top: rect.top, width: rect.width, height: rect.height};
    });
    const next: View = {id: drag.id, left: drag.left + x - drag.startX, top: drag.top + y - drag.startY, width: drag.width,
      x: position.x, y: position.y, free: drag.layout === 'free',
      target: drag.layout !== 'free' && inside ? findGroupDropTarget(rects, drag.id, x, y, drag.layout) : null};
    drag.view = next; setView(next);
    if (drag.frame == null) drag.frame = requestAnimationFrame(autoScroll);
  }
  function autoScroll() {
    const drag = session.current, board = boardRef.current;
    if (!drag || !board) return;
    drag.frame = null;
    const rect = board.getBoundingClientRect(), edge = 36;
    const step = (point: number, low: number, high: number) => point < low + edge ? -14 : point > high - edge ? 14 : 0;
    const previous = [board.scrollLeft, board.scrollTop, window.scrollX, window.scrollY];
    if (drag.lastY >= Math.max(0, rect.top) && drag.lastY <= Math.min(innerHeight, rect.bottom)) {
      board.scrollLeft += step(drag.lastX, Math.max(0, rect.left), Math.min(innerWidth, rect.right));
    }
    if (drag.lastX >= Math.max(0, rect.left) && drag.lastX <= Math.min(innerWidth, rect.right)) {
      board.scrollTop += step(drag.lastY, Math.max(0, rect.top), Math.min(innerHeight, rect.bottom));
    }
    window.scrollBy(step(drag.lastX, 0, innerWidth), step(drag.lastY, 0, innerHeight));
    if (previous.some((value, index) => value !== [board.scrollLeft, board.scrollTop, window.scrollX, window.scrollY][index])) update(drag.lastX, drag.lastY);
  }
  function start(event: ReactPointerEvent<HTMLButtonElement>, group: Group) {
    if (current.current.disabled || event.button !== 0 || !event.isPrimary || session.current || !boardRef.current) return;
    const element = event.currentTarget.closest<HTMLElement>('[data-group-id]');
    if (!element) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({preventScroll: true});
    const rect = element.getBoundingClientRect(), board = boardRef.current, bounds = board.getBoundingClientRect();
    session.current = {id: group.id, pointerId: event.pointerId, handle: event.currentTarget,
      startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY,
      left: rect.left, top: rect.top, width: rect.width, groupX: group.x, groupY: group.y,
      boardLeft: bounds.left, boardTop: bounds.top, scrollLeft: board.scrollLeft, scrollTop: board.scrollTop,
      layout: current.current.layout, active: false, frame: null, view: null};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function keyboard(event: ReactKeyboardEvent<HTMLButtonElement>, group: Group) {
    if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || current.current.disabled || session.current) return;
    event.preventDefault();
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (current.current.layout !== 'free') current.current.onReorder(group.id, current.current.groups.findIndex(item => item.id === group.id) + (backward ? -1 : 1));
    else {
      const step = event.shiftKey ? 50 : 10;
      const position = groupPosition(group.x, group.y, event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
        event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0);
      current.current.onPosition(group.id, position.x, position.y);
    }
  }
  useEffect(() => {
    const move = (event: PointerEvent) => {if (session.current?.pointerId === event.pointerId) {event.preventDefault(); update(event.clientX, event.clientY);}};
    const end = (event: PointerEvent) => {
      const drag = session.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.active) update(event.clientX, event.clientY);
      const result = drag.view;
      cancel();
      if (!result || current.current.layout !== drag.layout || current.current.disabled) return;
      if (result.free) current.current.onPosition(drag.id, result.x, result.y);
      else if (result.target) current.current.onReorder(drag.id, result.target.index);
    };
    const abort = (event: PointerEvent) => {if (session.current?.pointerId === event.pointerId) cancel();};
    const lost = (event: PointerEvent) => {if (session.current?.pointerId === event.pointerId) cancel();};
    const key = (event: KeyboardEvent) => {if (event.key === 'Escape' && session.current) {event.preventDefault(); cancel();}};
    window.addEventListener('pointermove', move, {passive: false}); window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', abort); window.addEventListener('lostpointercapture', lost);
    window.addEventListener('keydown', key); window.addEventListener('blur', cancel); window.addEventListener('resize', cancel);
    return () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', abort); window.removeEventListener('lostpointercapture', lost);
      window.removeEventListener('keydown', key); window.removeEventListener('blur', cancel); window.removeEventListener('resize', cancel); cancel();
    };
  }, []);
  return {boardRef, session, view, start, keyboard};
}
