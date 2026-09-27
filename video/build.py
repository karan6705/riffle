"""Mux the recorded demo with narration and burned-in captions.

Run after `node record.cjs ...`. Produces riffle-demo.mp4 and riffle-demo.srt.
"""
import json
import re
import subprocess

LEAD = 0.35  # seconds between a scene starting and its narration starting

tl = json.load(open('timeline.json'))
dur = json.load(open('durations.json'))
segs = dict(json.load(open('narration.json')))
keys = list(tl['starts'].keys())

# Narration track: each clip delayed to its scene start.
inputs, filters = [], []
for i, k in enumerate(keys):
    inputs += ['-i', f'{k}.mp3']
    ms = int((tl['starts'][k] + LEAD) * 1000)
    filters.append(f'[{i}:a]adelay={ms}|{ms}[a{i}]')
filters.append(''.join(f'[a{i}]' for i in range(len(keys))) + f'amix=inputs={len(keys)}:normalize=0,apad[aout]')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filters),
                '-map', '[aout]', '-t', str(tl['total']), '-ar', '48000', 'narration_track.wav'], check=True)


def ts(t):
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f'{h:02}:{m:02}:{s:06.3f}'.replace('.', ',')


# Captions: sentences (long ones split at commas), timed by share of characters.
cues, n = [], 1
for k in keys:
    chunks = []
    for p in (p.strip() for p in re.split(r'(?<=[.:!?])\s+', segs[k]) if p.strip()):
        while len(p) > 90:
            cut = p.rfind(', ', 0, 90)
            if cut < 30:
                cut = p.rfind(' ', 0, 90)
            chunks.append(p[:cut + 1].strip())
            p = p[cut + 1:].strip()
        chunks.append(p)
    total = sum(len(c) for c in chunks)
    t = tl['starts'][k] + LEAD
    for c in chunks:
        d = dur[k] * len(c) / total
        cues.append(f'{n}\n{ts(t)} --> {ts(t + d - 0.05)}\n{c}\n')
        n += 1
        t += d
open('riffle-demo.srt', 'w').write('\n'.join(cues))

style = ('FontName=Helvetica,FontSize=15,PrimaryColour=&H00FFFFFF,BackColour=&H99202E2D,'
         'BorderStyle=4,Outline=0,Shadow=0,MarginV=22,Alignment=2')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', tl['raw'], '-i', 'narration_track.wav',
                '-filter_complex', f"[0:v]fps=30,subtitles=riffle-demo.srt:force_style='{style}'[v]",
                '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', 'riffle-demo.mp4'], check=True)
print('wrote riffle-demo.mp4 with', n - 1, 'captions')
