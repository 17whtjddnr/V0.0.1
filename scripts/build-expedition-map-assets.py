"""Build guild map geometry and WebP assets from the supplied artwork.

Requires Pillow and Shapely. The original artwork remains untouched.
"""
import copy
import json
import re
import sys
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
tag = lambda name: f'{{{NS}}}{name}'
config = json.loads((ROOT / 'data/maps/expedition-regions.json').read_text(encoding='utf-8'))
source = ROOT / 'OriginalData/BG/Battlelocation'
asset = lambda name: re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

for image in ([] if '--geometry-only' in sys.argv else source.glob('*.png')):
    Image.open(image).convert('RGB').save(ROOT / f'public/assets/backgrounds/battle-{asset(image.stem)}.webp', 'WEBP', quality=85, method=6)
for name in ([] if '--geometry-only' in sys.argv else ['Old city'] + [region['destinations'][-1]['image'] for region in config.values()]):
    Image.open(source / 'Finals' / f'{name}.png').convert('RGB').save(ROOT / f'public/assets/backgrounds/battle-final-{asset(name)}.webp', 'WEBP', quality=85, method=6)

def geometry(path):
    rings = []
    for ring in re.findall(r'M([^M]+)', path):
        numbers = [float(value) for value in re.findall(r'-?\d+(?:\.\d+)?', ring)]
        if len(numbers) >= 6:
            rings.append(Polygon(list(zip(numbers[::2], numbers[1::2]))).buffer(0))
    shape = Polygon()
    for ring in rings:
        shape = shape.symmetric_difference(ring)
    return shape

def polygons(shape):
    return [shape] if shape.geom_type == 'Polygon' else [part for part in shape.geoms if part.geom_type == 'Polygon']

def svg_path(shape):
    paths = []
    for polygon in polygons(shape):
        for ring in [polygon.exterior, *polygon.interiors]:
            coords = list(ring.coords)[:-1]
            paths.append('M' + 'L'.join(f'{x:.3f} {y:.3f}' for x, y in coords) + 'Z')
    return ''.join(paths)

tree = ET.parse(ROOT / 'public/assets/maps/fantasy_map_layers.svg')
svg = tree.getroot()
stormreach = json.loads((ROOT / 'data/maps/stormreach-region.json').read_text(encoding='utf-8'))
regions = {'Stormreach': {**stormreach, 'name': '스톰리치', 'markers': [[350,731,'meadow'],[412,748,'mistwood'],[386,780,'quietleaf'],[452,790,'ashabyss'],[421,832,'windcastle']]}}
marker_template = next(el for el in svg.iter() if 'stormreach-marker' in el.get('class', '').split())

for name, definition in config.items():
    group = next(el for el in svg.iter(tag('g')) if el.get('data-region-name') == name)
    label = group.find(tag('text'))
    label_x, label_y = float(label.get('x')), float(label.get('y'))
    original = geometry(group.find(tag('path')).get('d'))
    cores = polygons(original.buffer(-1.5))
    core = next((part for part in cores if part.covers(Point(label_x, label_y))), max(cores, key=lambda part: part.area))
    main = core.buffer(1.5).intersection(original)
    shape = unary_union([main, *[part for part in polygons(original) if part.area > 4 and not part.intersects(main) and part.distance(main) < 12]])
    path = svg_path(shape)
    min_x, min_y, max_x, max_y = shape.bounds
    width, height = max_x-min_x, max_y-min_y
    interior = main.buffer(-6)
    if interior.is_empty:
        interior = main
    candidates = [Point(min_x+width*x/40, min_y+height*y/40) for x in range(2,39) for y in range(2,39)]
    candidates = [point for point in candidates if interior.contains(point)]
    count = len(definition['destinations'])
    rows = (count+1)//2
    chosen = []
    for index in range(count):
        target = Point(min_x+width*(.22 if index%2==0 else .68), min_y+height*(.12+.76*(index//2)/max(1,rows-1)))
        def score(point):
            distance = ((point.x-target.x)/width)**2+((point.y-target.y)/height)**2
            for previous in chosen:
                dx,dy = abs(point.x-previous.x)/width, abs(point.y-previous.y)/height
                if dx < .4 and dy < .17:
                    distance += 5*(.4-dx)*(.17-dy)
            return distance
        chosen.append(min(candidates, key=score))
    markers = [[round(point.x,3),round(point.y,3),f'{name.lower()}-{index+1}'] for index,point in enumerate(chosen)]
    regions[name] = {'region':name,'name':definition['name'],'path':path,'label':{'x':label_x,'y':label_y,'width':240,'height':56},'markers':markers}

    focused = ET.Element(tag('svg'), {'viewBox':'0 0 1536 1024','width':'1536','height':'1024'})
    ET.SubElement(focused,tag('path'),{'d':path,'fill':'#ffffff','fill-opacity':'.16','stroke':'#ffffff','stroke-opacity':'.35','stroke-width':'1','fill-rule':'evenodd','vector-effect':'non-scaling-stroke'})
    ET.ElementTree(focused).write(ROOT / f'public/assets/maps/fantasy_map_{name.lower()}_focused.svg',encoding='utf-8',xml_declaration=True)

    # Use corrected regional geometry so the glow stays within each region.
    for element_id in [f'{name.lower()}-focus',f'{name.lower()}-outline']:
        for existing in list(svg):
            if existing.get('id') == element_id:
                svg.remove(existing)
    fill = ET.SubElement(svg,tag('g'),{'id':f'{name.lower()}-focus','class':'playable-region-focus','fill':'#ffffff','fill-opacity':'0'})
    ET.SubElement(fill,tag('path'),{'d':path,'fill-rule':'evenodd'})
    outline = ET.SubElement(svg,tag('g'),{'id':f'{name.lower()}-outline','class':'playable-region-outline','fill':'none','stroke':'#ffe477','stroke-width':'1.2','opacity':'0','filter':'url(#stormreach-yellow-glow)'})
    ET.SubElement(outline,tag('path'),{'d':path,'vector-effect':'non-scaling-stroke'})
    marker_id = f'{name.lower()}-world-marker'
    for existing in list(svg):
        if existing.get('id') == marker_id:
            svg.remove(existing)
    marker = copy.deepcopy(marker_template)
    marker.set('id',marker_id)
    marker.set('transform',f'translate({label_x-384} {label_y-736})')
    # Keep its bob animation on the inner group so it does not replace the offset.
    wrapper = ET.Element(tag('g'),{'id':marker_id,'transform':marker.get('transform')})
    marker.attrib.pop('transform',None)
    marker.attrib.pop('id',None)
    for element in marker.iter():
        for key,value in list(element.attrib.items()):
            if key=='id': element.set(key,f'{name.lower()}-{value}')
            elif 'url(#' in value: element.set(key,value.replace('url(#',f'url(#{name.lower()}-'))
    wrapper.append(marker)
    svg.append(wrapper)

style = svg.find(tag('style'))
if '/* playable guild regions */' not in style.text:
    style.text += '''
/* playable guild regions */
.playable-region-focus { animation: stormreach-highlight 2.4s ease-in-out 2.775s infinite both; }
.playable-region-outline { animation: stormreach-outline-glow 2.4s ease-in-out 2.775s infinite both; }
@media (prefers-reduced-motion: reduce) {
    .playable-region-focus { animation: none; fill-opacity: .16; }
    .playable-region-outline { animation: none; opacity: .7; }
}
'''
tree.write(ROOT / 'public/assets/maps/fantasy_map_layers.svg',encoding='utf-8',xml_declaration=True)
storm_world = copy.deepcopy(svg)
for element in list(storm_world):
    if element.get('class') in ['playable-region-focus', 'playable-region-outline'] or element.get('id', '').endswith('-world-marker'):
        storm_world.remove(element)
storm_world.find(tag('style')).text += '\ng[data-region-name]:not([data-region-name="Stormreach"]) > text { fill: #a0aaa4; }\n'
ET.ElementTree(storm_world).write(ROOT / 'public/assets/maps/fantasy_map_stormreach_world.svg',encoding='utf-8',xml_declaration=True)
(ROOT / 'data/maps/guild-regions.json').write_text(json.dumps(regions,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'regions':{name:len(region['markers']) for name,region in regions.items()},'normal_backgrounds':len(list(source.glob('*.png')))},ensure_ascii=True))
