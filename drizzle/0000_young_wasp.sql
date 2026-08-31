CREATE TABLE "gasto" (
	"id" uuid PRIMARY KEY NOT NULL,
	"juntada_id" uuid NOT NULL,
	"descripcion" text NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"pagador_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "juntada" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "juntada_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pago" (
	"id" uuid PRIMARY KEY NOT NULL,
	"juntada_id" uuid NOT NULL,
	"de_id" uuid NOT NULL,
	"a_id" uuid NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participante" (
	"id" uuid PRIMARY KEY NOT NULL,
	"juntada_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reparto" (
	"gasto_id" uuid NOT NULL,
	"participante_id" uuid NOT NULL,
	"monto_centavos" bigint NOT NULL,
	CONSTRAINT "reparto_gasto_id_participante_id_pk" PRIMARY KEY("gasto_id","participante_id")
);
--> statement-breakpoint
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_juntada_id_juntada_id_fk" FOREIGN KEY ("juntada_id") REFERENCES "public"."juntada"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_pagador_id_participante_id_fk" FOREIGN KEY ("pagador_id") REFERENCES "public"."participante"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_juntada_id_juntada_id_fk" FOREIGN KEY ("juntada_id") REFERENCES "public"."juntada"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_de_id_participante_id_fk" FOREIGN KEY ("de_id") REFERENCES "public"."participante"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_a_id_participante_id_fk" FOREIGN KEY ("a_id") REFERENCES "public"."participante"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participante" ADD CONSTRAINT "participante_juntada_id_juntada_id_fk" FOREIGN KEY ("juntada_id") REFERENCES "public"."juntada"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparto" ADD CONSTRAINT "reparto_gasto_id_gasto_id_fk" FOREIGN KEY ("gasto_id") REFERENCES "public"."gasto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparto" ADD CONSTRAINT "reparto_participante_id_participante_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participante"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gasto_juntada_idx" ON "gasto" USING btree ("juntada_id");--> statement-breakpoint
CREATE INDEX "pago_juntada_idx" ON "pago" USING btree ("juntada_id");--> statement-breakpoint
CREATE INDEX "participante_juntada_idx" ON "participante" USING btree ("juntada_id");