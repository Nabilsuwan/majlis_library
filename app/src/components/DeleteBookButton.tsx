"use client";

import { TrashIcon } from "@/lib/icons";

export default function DeleteBookButton({
  bookId,
  deleteAction,
}: {
  bookId: string;
  deleteAction: (formData: FormData) => void;
}) {
  return (
    <form
      action={deleteAction}
      onSubmit={(e) => {
        if (!confirm("هل أنت متأكد من حذف هذا الكتاب؟ لا يمكن التراجع عن هذا الإجراء.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={bookId} />
      <button
        type="submit"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          color: "#9B2226",
          fontSize: 13,
          cursor: "pointer",
          padding: 0,
        }}
      >
        <TrashIcon />
        حذف
      </button>
    </form>
  );
}
