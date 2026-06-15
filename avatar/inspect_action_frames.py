"""
inspect_action_frames.py – see what frame each pose action has keys at
"""
import bpy, json

VISEME_ACTIONS = ['A','B','C','D','E','F','H','X']

info = {}
for name in VISEME_ACTIONS:
    act = bpy.data.actions.get(name)
    if not act:
        info[name] = 'NOT FOUND'
        continue
    frames = set()
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            frames.add(int(round(kp.co[0])))
        # Also note what bones are keyed
    bones_keyed = list({fc.data_path.split('"')[1] for fc in act.fcurves
                        if '"' in fc.data_path})[:8]
    info[name] = {'frames': sorted(frames), 'bones_sample': bones_keyed}

print(json.dumps(info, indent=2))
