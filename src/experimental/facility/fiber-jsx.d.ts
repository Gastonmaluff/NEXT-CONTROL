import type { ThreeElements } from '@react-three/fiber';

// Runtime React 18 uses Fiber 8. The host repo already uses React 19 types,
// whose JSX namespace is scoped to React rather than the old global namespace.
// Bridge only the renderer's intrinsic types; do not change the host dependencies.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends Pick<ThreeElements, 'group' | 'mesh' | 'instancedMesh' | 'meshStandardMaterial' | 'color' | 'ambientLight' | 'directionalLight'> {}
  }
}
