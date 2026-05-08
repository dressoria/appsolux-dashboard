import { redirect } from "next/navigation";

type ConversationDetailPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
};

export default async function ConversationDetailPage({
  params,
}: ConversationDetailPageProps) {
  const { conversationId } = await params;

  redirect(`/conversations?conversationId=${conversationId}`);
}
