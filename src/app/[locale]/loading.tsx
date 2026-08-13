import LoadingScreen from "@/src/components/LoadingScreen";

/**
 * The suspense boundary for the whole locale tree. Nested segments inherit it
 * unless they ship a `loading.tsx` of their own — `/collections` does, with a
 * skeleton shaped like the page it is standing in for.
 */
export default function Loading() {
  return <LoadingScreen />;
}
