"""
inspect_avatar.py  – print all bone names and shape key names from the blend file
"""
import bpy

print("\n=== ARMATURE BONES ===")
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        print(f"Armature: {obj.name}")
        for bone in obj.data.bones:
            print(f"  BONE: {bone.name}")

print("\n=== MESH SHAPE KEYS ===")
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.data.shape_keys:
        print(f"Mesh: {obj.name}")
        for kb in obj.data.shape_keys.key_blocks:
            print(f"  SHAPE KEY: {kb.name}")

print("\n=== DONE ===")
