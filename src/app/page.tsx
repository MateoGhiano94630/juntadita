import { FormularioCrear } from "@/componentes/FormularioCrear";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Nueva juntada</h1>
        <p className="mt-2 text-stone-600">
          Cargá quiénes van y compartí el link al grupo. Nadie tiene que instalar nada.
        </p>
      </header>

      <FormularioCrear />
    </main>
  );
}
