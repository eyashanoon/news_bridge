"""
bake_poses_to_shapekeys.py
Bakes each viseme pose asset (A,B,C,D,E,F,G,H,X) into a named shape key
on the Retopo mesh, then exports the GLB.

Run with:
  blender --background "path/to/Untitled888888.blend" --python "path/to/this.py"
"""
import bpy
import os

OUTPUT_PATH   = r"C:\Users\eyash\gggg\public\models\avatar.glb"
MESH_NAME     = 'Retopo_tripo_node_56ade3d9-b439-4635-8683-30df461950d1.001'
ARM_NAME      = 'rig'
POSE_FRAME    = 1          # all poses are keyed at frame 1
# Map output shape key name → action name in blend file
VISEME_ACTIONS = [
    ('A', 'AAA'),
    ('B', 'BBB'),
    ('C', 'CCC'),
    ('D', 'DDD'),
    ('E', 'EEE'),
    ('F', 'FFF'),
    ('G', 'GGG'),
    ('H', 'HHH'),
    ('X', 'XXX'),
]

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

mesh_obj = bpy.data.objects.get(MESH_NAME)
arm_obj  = bpy.data.objects.get(ARM_NAME)

if not mesh_obj:
    raise RuntimeError(f"Mesh '{MESH_NAME}' not found. Objects: {[o.name for o in bpy.data.objects]}")
if not arm_obj:
    raise RuntimeError(f"Armature '{ARM_NAME}' not found.")

# ── Make sure mesh has shape keys (needs at least a Basis) ────────────────
if not mesh_obj.data.shape_keys:
    mesh_obj.shape_key_add(name='Basis', from_mix=False)
    print("[Bake] Created Basis shape key")

basis_key = mesh_obj.data.shape_keys.key_blocks.get('Basis')
if not basis_key:
    basis_key = mesh_obj.data.shape_keys.key_blocks[0]
    basis_key.name = 'Basis'

# Set all existing non-Basis keys to 0 so Basis is the resting pose
for key in mesh_obj.data.shape_keys.key_blocks:
    if key.name != 'Basis':
        key.value = 0.0

# ── Ensure armature has animation data ────────────────────────────────────
if not arm_obj.animation_data:
    arm_obj.animation_data_create()

# ── Bake each pose action as a shape key ─────────────────────────────────
for (sk_name, action_name) in VISEME_ACTIONS:
    act = bpy.data.actions.get(action_name)
    if not act:
        print(f"[Bake] WARNING: action '{action_name}' not found, skipping")
        continue

    # Remove old shape key with this name if it exists (clean re-bake)
    old_sk = mesh_obj.data.shape_keys.key_blocks.get(sk_name)
    if old_sk:
        mesh_obj.shape_key_remove(old_sk)
        print(f"[Bake] Removed old shape key '{sk_name}'")

    # Apply the action to the armature at frame 1
    arm_obj.animation_data.action = act
    bpy.context.scene.frame_set(POSE_FRAME)
    bpy.context.view_layer.update()

    # Evaluate the deformed mesh via depsgraph (captures armature deformation)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj  = mesh_obj.evaluated_get(depsgraph)
    eval_mesh = eval_obj.to_mesh()

    # Add a new shape key
    sk = mesh_obj.shape_key_add(name=sk_name, from_mix=False)

    # Copy the deformed vertex positions into the shape key
    # Transform from eval_obj world space back to mesh_obj local space
    w2l = mesh_obj.matrix_world.inverted()
    for i, v in enumerate(eval_mesh.vertices):
        sk.data[i].co = w2l @ (eval_obj.matrix_world @ v.co)

    # Reset value to 0 (Basis state)
    sk.value = 0.0

    eval_obj.to_mesh_clear()
    print(f"[Bake] ✓ Shape key '{sk_name}' created from action '{action_name}' at frame {POSE_FRAME}")

# ── Reset armature to Basis (no action / frame 0) ─────────────────────────
arm_obj.animation_data.action = None
bpy.context.scene.frame_set(0)
bpy.context.view_layer.update()

print(f"\n[Bake] Shape keys on '{MESH_NAME}':")
for key in mesh_obj.data.shape_keys.key_blocks:
    print(f"  {key.name}")

# ── Export GLB ─────────────────────────────────────────────────────────────
# Draco MUST be disabled — it strips morph targets from the export
print(f"\n[Bake] Exporting to {OUTPUT_PATH} ...")

def get_props():
    try:
        return set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    except Exception:
        return set()

op_props = get_props()
def kw(name, value):
    return {name: value} if name in op_props else {}

kwargs = {
    'filepath':      OUTPUT_PATH,
    'export_format': 'GLB',
    'use_selection': False,
}
kwargs.update(kw('export_normals',         True))
kwargs.update(kw('export_texcoords',       True))
kwargs.update(kw('export_colors',          True))
kwargs.update(kw('export_morph',           True))
kwargs.update(kw('export_morph_normal',    False))
kwargs.update(kw('export_morph_tangent',   False))
kwargs.update(kw('export_skins',           True))
kwargs.update(kw('export_animations',      False))  # no animation needed, only shape keys
kwargs.update(kw('export_materials',       'EXPORT'))
kwargs.update(kw('export_image_format',    'JPEG'))
kwargs.update(kw('export_jpeg_quality',    65))
kwargs.update(kw('export_draco_mesh_compression_enable', False))  # MUST be False for morph targets
kwargs.update(kw('export_yup',             True))
kwargs.update(kw('will_save_settings',     False))

bpy.ops.export_scene.gltf(**kwargs)
print(f"[Bake] ✓ Exported to {OUTPUT_PATH}")
