import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

async function authHeaderToToken(header: string | null) {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function PATCH(
  request: Request,
  { params }: { params: { uid: string } },
) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const token = await authHeaderToToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const adminRef = adminDb.collection("users").doc(decoded.uid);
    const adminSnap = await adminRef.get();

    if (!adminSnap.exists || adminSnap.data()?.role !== "admin") {
      return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
    }

    const { uid } = params;
    if (!uid || uid === decoded.uid) {
      return NextResponse.json(
        { error: "Nao e permitido alterar a propria conta por esta rota." },
        { status: 400 },
      );
    }

    const alvoRef = adminDb.collection("users").doc(uid);
    const alvoSnap = await alvoRef.get();

    if (!alvoSnap.exists) {
      return NextResponse.json({ error: "Mediador nao encontrado." }, { status: 404 });
    }

    const alvo = alvoSnap.data();
    if (alvo?.role !== "mediador") {
      return NextResponse.json(
        { error: "A rota administrativa so pode gerenciar mediadores." },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: "archive" | "restore";
    };

    if (body.action === "restore") {
      await Promise.all([
        adminAuth.updateUser(uid, { disabled: false }),
        alvoRef.update({
          ativo: true,
          deletado: false,
          deletadoEm: FieldValue.delete(),
          deletadoPor: FieldValue.delete(),
        }),
      ]);

      return NextResponse.json({
        message: `Mediador ${alvo?.nome ?? ""} restaurado com sucesso.`,
      });
    }

    if (body.action !== "archive") {
      return NextResponse.json({ error: "Acao invalida." }, { status: 400 });
    }

    await Promise.all([
      adminAuth.updateUser(uid, { disabled: true }),
      alvoRef.update({
        ativo: false,
        deletado: true,
        deletadoEm: FieldValue.serverTimestamp(),
        deletadoPor: decoded.uid,
      }),
    ]);

    return NextResponse.json({
      message: `Mediador ${alvo?.nome ?? ""} arquivado com sucesso.`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar o mediador.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
