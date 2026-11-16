"""Generate native launcher assets from the approved RepPilot mark. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw
mark = Image.open('public/brand/reppilot-mark-v1.png').convert('RGB')
mark.resize((1024,1024), Image.Resampling.LANCZOS).save('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
for density, size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
 folder=Path(f'android/app/src/main/res/mipmap-{density}')
 folder.mkdir(parents=True,exist_ok=True)
 icon=mark.resize((size,size),Image.Resampling.LANCZOS)
 icon.save(folder/'ic_launcher.png')
 mask=Image.new('L',(size,size)); ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255)
 rounded=icon.convert('RGBA'); rounded.putalpha(mask); rounded.save(folder/'ic_launcher_round.png')
 # Adaptive icon uses a larger safe canvas so the mark survives launcher masks.
 foreground=Image.new('RGBA',(size*108//48,size*108//48),(16,38,62,255))
 foreground.paste(icon,((foreground.width-size)//2,(foreground.height-size)//2))
 foreground.save(folder/'ic_launcher_foreground.png')
print('Native iOS and Android RepPilot launcher assets generated.')
