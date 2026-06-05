"""
inspect_poses.py
Run with: blender --background "path/to/file.blend" --python "path/to/this.py"
Lists all shape keys, pose assets, and action names so we know exactly what exists.
"""
import bpy, json

out = {}

# ── Shape keys on all meshes ─────────────────────────────────────────────
out['shape_keys'] = {}
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.data.shape_keys:
        keys = [k.name for k in obj.data.shape_keys.key_blocks]
        out['shape_keys'][obj.name] = keys

# ── Pose assets / pose library entries ───────────────────────────────────
# Blender 3+ stores pose assets as Actions with asset_data set
out['pose_assets'] = []
for action in bpy.data.actions:
    if action.asset_data is not None:
        out['pose_assets'].append({
            'name': action.name,
            'tags': [t.name for t in action.asset_data.tags],
        })

# Also check old-style PoseLibrary (Blender 2.x–3.x) — attribute removed in Blender 4+
out['pose_library_poses'] = {}
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        lib = getattr(obj, 'pose_library', None)
        if lib:
            out['pose_library_poses'][obj.name] = [
                {'name': m.name, 'frame': m.frame} for m in lib.pose_markers
            ]

# ── All actions (named) ───────────────────────────────────────────────────
out['all_actions'] = [a.name for a in bpy.data.actions]

# ── NLA strips per armature ───────────────────────────────────────────────
out['nla_strips'] = {}
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE' and obj.animation_data:
        strips = []
        for track in obj.animation_data.nla_tracks:
            for strip in track.strips:
                strips.append({'track': track.name, 'strip': strip.name,
                                'action': strip.action.name if strip.action else None,
                                'frame_start': strip.frame_start,
                                'frame_end':   strip.frame_end})
        out['nla_strips'][obj.name] = strips

print("=== INSPECT OUTPUT START ===")
print(json.dumps(out, indent=2))
print("=== INSPECT OUTPUT END ===")
