"""
export_avatar.py
Run with: blender --background "path/to/file.blend" --python "path/to/this.py"

Exports the scene as a GLB file optimised for Three.js / lip-sync:
  - All meshes + armature
  - Textures embedded (JPEG-compressed for size)
  - Shape keys exported as morph targets (needed for viseme lip-sync)
  - Armature exported for rig-driven animation
  - Y-up / metre units (Three.js default)
"""

import bpy
import os

OUTPUT_PATH = r"C:\Users\eyash\gggg\public\models\avatar.glb"

# ── Ensure output directory exists ───────────────────────────────────────────
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# ── Override context so ops work in background mode ──────────────────────────
# Find a valid 3D viewport or use the Scene directly
def get_ctx():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == 'VIEW_3D':
                for region in area.regions:
                    if region.type == 'WINDOW':
                        return {'window': window, 'screen': window.screen,
                                'area': area, 'region': region,
                                'scene': bpy.context.scene}
    return None

ctx = get_ctx()

# ── Select ALL objects that are actually in the view layer ───────────────────
vl_objects = set(bpy.context.view_layer.objects)
for obj in bpy.data.objects:
    if obj in vl_objects:
        try:
            obj.select_set(True)
        except Exception:
            pass

# ── Add a skin-toned base colour to meshes with no material ──────────────────
for obj in bpy.data.objects:
    if obj.type == 'MESH' and len(obj.data.materials) == 0:
        mat = bpy.data.materials.new(name="AutoSkin")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.78, 0.53, 0.35, 1.0)
            bsdf.inputs["Roughness"].default_value  = 0.75
        obj.data.materials.append(mat)

# ── Export ───────────────────────────────────────────────────────────────────
# ── Export ───────────────────────────────────────────────────────────────────
# Discover what parameters this Blender build's gltf exporter actually accepts
import inspect
op_props = set()
try:
    op_props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
except Exception:
    pass

def gltf_kwarg(name, value):
    return {name: value} if name in op_props else {}

kwargs = {
    'filepath':       OUTPUT_PATH,
    'export_format':  'GLB',
    'use_selection':  False,
}
kwargs.update(gltf_kwarg('export_apply',                 False))
kwargs.update(gltf_kwarg('export_normals',               True))
kwargs.update(gltf_kwarg('export_tangents',              True))
kwargs.update(gltf_kwarg('export_texcoords',             True))
kwargs.update(gltf_kwarg('export_colors',                True))
kwargs.update(gltf_kwarg('export_attributes',            True))
kwargs.update(gltf_kwarg('export_morph',                          True))
kwargs.update(gltf_kwarg('export_morph_normal',                   True))
kwargs.update(gltf_kwarg('export_morph_tangent',                  False))
kwargs.update(gltf_kwarg('export_skins',                          True))
kwargs.update(gltf_kwarg('export_all_influences',                 False))
kwargs.update(gltf_kwarg('export_animations',                     True))
kwargs.update(gltf_kwarg('export_frame_range',                    True))
kwargs.update(gltf_kwarg('export_anim_single_armature',           True))
kwargs.update(gltf_kwarg('export_materials',                      'EXPORT'))
kwargs.update(gltf_kwarg('export_image_format',                   'JPEG'))
kwargs.update(gltf_kwarg('export_jpeg_quality',                   55))   # was 88, much smaller
# ── Draco mesh compression ───────────────────────────────────────────────────
# IMPORTANT: Draco STRIPS morph targets (shape keys) from the export.
# Keep Draco DISABLED so that mouthOpen / mouthSmile shape keys survive.
# The file will be larger (~40-60 MB) but lip sync will work correctly.
kwargs.update(gltf_kwarg('export_draco_mesh_compression_enable',  False))
# ────────────────────────────────────────────────────────────────────────────
kwargs.update(gltf_kwarg('export_yup',                            True))
kwargs.update(gltf_kwarg('export_extras',                         False))
kwargs.update(gltf_kwarg('will_save_settings',                    False))

print(f"[export_avatar] Exporting with kwargs: {list(kwargs.keys())}")
bpy.ops.export_scene.gltf(**kwargs)
print(f"[export_avatar] Done → {OUTPUT_PATH}")
