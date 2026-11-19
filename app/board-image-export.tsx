'use client';
import {useEffect, useRef, useState} from 'react';
import type {BoardImageFile, ImageBoard} from '../lib/board-image';

type Preview = BoardImageFile & {url: string; filename: string};
export default function BoardImageExport({name, data, saving}: ImageBoard & {saving: boolean}) {
  const [open, setOpen] = useState(false), [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null), [error, setError] = useState(''), [canShare, setCanShare] = useState(false);
  const request = useRef(0), trigger = useRef<HTMLButtonElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => {request.current++;}, []);
  useEffect(() => () => {if (preview) URL.revokeObjectURL(preview.url);}, [preview]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; closeButton.current?.focus();
    return () => {document.body.style.overflow = previous; trigger.current?.focus();};
  }, [open]);
  function close() {request.current++; setOpen(false); setPreparing(false); setPreview(null); setError('');}
  async function prepare() {
    if (saving || preparing) return;
    const current = ++request.current;
    setOpen(true); setPreparing(true); setError(''); setPreview(null); setCanShare(false);
    try {
      const {createBoardImage} = await import('../lib/board-image');
      const result = await createBoardImage({name, data});
      if (request.current !== current) return;
      const filename = result.fileBaseName + '.' + result.format.toLowerCase();
      setPreview({...result, filename, url: URL.createObjectURL(result.blob)});
      try {setCanShare(!!navigator.canShare?.({files: [new File([result.blob], filename, {type: result.blob.type})]}));} catch {setCanShare(false);}
    } catch {if (request.current === current) setError('画像を作成できませんでした。もう一度お試しください。');}
    finally {if (request.current === current) setPreparing(false);}
  }
  async function share() {
    if (!preview) return;
    try {await navigator.share({files: [new File([preview.blob], preview.filename, {type: preview.blob.type})], title: name});}
    catch (error) {if (!(error instanceof DOMException && error.name === 'AbortError')) setError('共有できませんでした。画像の保存ボタンをご利用ください。');}
  }
  return <>
    <button ref={trigger} type="button" className="image-export-trigger" onClick={prepare} disabled={saving || preparing} title="全グループ・全タスクを画像として保存">▧ 画像を保存</button>
    {open && <div className="editor-backdrop image-export-backdrop" onMouseDown={event => {if (event.target === event.currentTarget) close();}}>
      <section className="editor-dialog image-export-dialog" role="dialog" aria-modal="true" aria-labelledby="image-export-title" aria-describedby="image-export-description"
        onKeyDown={event => {
          if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); close();}
          if (event.key === 'Tab') {
            const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]'));
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
            else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
          }
        }}>
        <div className="image-export-heading"><h2 id="image-export-title">全体を画像に保存</h2><button ref={closeButton} type="button" onClick={close} aria-label="画像保存を閉じる">×</button></div>
        <p id="image-export-description">保存用にグループを整列し、スクロールで隠れたタスクもすべて表示します。</p>
        {preparing && <p role="status">画像を作成しています…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {preview && <>
          <p className="image-export-meta">{preview.groupCount} グループ・{preview.taskCount} タスク ／ {preview.width} × {preview.height}px ／ {preview.format}</p>
          {preview.format === 'SVG' && <p className="image-export-note">大きなボードのため、拡大しても文字が鮮明なSVG画像で保存します。</p>}
          <div className="image-export-preview"><img src={preview.url} width={preview.width} height={preview.height} alt={`${name}：全${preview.groupCount}グループ・${preview.taskCount}タスクの保存画像`}/></div>
          <div className="image-export-buttons"><a className="image-export-download" href={preview.url} download={preview.filename}>{preview.format}を保存</a>
            {canShare && <button type="button" onClick={share}>共有・写真に保存</button>}</div>
          <p className="image-export-note">保存先はブラウザのダウンロード設定によります。画像は作成時点の内容です。</p>
        </>}
      </section>
    </div>}
  </>;
}
