import Link from "next/link";

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 text-center">
      <h1 className="text-2xl font-bold">Esta juntada no existe</h1>
      <p className="text-stone-600">
        Puede que el link esté cortado. Fijate de copiarlo entero del mensaje.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-2xl bg-stone-900 px-6 py-4 font-semibold text-white"
      >
        Crear una nueva
      </Link>
    </main>
  );
}
