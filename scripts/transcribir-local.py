"""Whisper on CPU. Download is an explicit setup step, never an audio request."""
import json
import pathlib
import sys
from faster_whisper import WhisperModel

root = pathlib.Path(__file__).resolve().parent.parent
model_dir = root / '.local' / 'voice-model'
if sys.argv[1:] == ['--install-model']:
    from huggingface_hub import snapshot_download
    snapshot_download('Systran/faster-whisper-small', local_dir=str(model_dir))
    (root / '.local' / 'voice' / 'ready').write_text('small cpu int8', encoding='utf-8')
    print('Modelo de voz descargado.')
else:
    import av
    with av.open(sys.argv[1]) as container:
        if container.duration is not None and container.duration / av.time_base > 65:
            raise ValueError('El audio supera los 60 segundos permitidos.')
    model = WhisperModel(str(model_dir), device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
    segments, info = model.transcribe(sys.argv[1], language='es', beam_size=3, vad_filter=True)
    text = ' '.join(s.text.strip() for s in segments).strip()
    print(json.dumps({'text': text, 'language': info.language}, ensure_ascii=True))
