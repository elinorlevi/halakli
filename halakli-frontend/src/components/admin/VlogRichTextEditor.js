// src/components/admin/VlogRichTextEditor.jsx
import React, { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import {
  TextStyle,
  FontFamily,
  FontSize,
} from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import { Node } from "@tiptap/core";

// אותו בסיס כמו בשאר הקומפוננטות
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  "";

// 🔧 מרחיבים את Image כדי לאפשר style + data-size + data-align
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: { default: null },
      "data-size": { default: null },
      "data-align": { default: null },
    };
  },
});

// 🔧 נוד חדש לוידאו עם אותם אטריביוטים
const CustomVideo = Node.create({
  name: "videoBlock",
  group: "block",
  inline: false,
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      style: { default: null },
      "data-size": { default: null },
      "data-align": { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "video" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", { ...HTMLAttributes }];
  },

  addCommands() {
    return {
      setVideoBlock:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

const FONT_OPTIONS = [
  { label: "ברירת מחדל", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  {
    label: "Assistant",
    value:
      "Assistant, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  { label: "Alef", value: "'Alef', sans-serif" },
  { label: "Heebo", value: "'Heebo', sans-serif" },
  { label: "Rubik", value: "'Rubik', sans-serif" },
  { label: "Varela Round", value: "'Varela Round', sans-serif" },
  { label: "Secular One", value: "'Secular One', sans-serif" },
  { label: "David", value: "'David', 'David Libre', serif" },
  {
    label: "FrankRuehl",
    value: "'Frank Ruehl', 'Times New Roman', serif",
  },
  {
    label: "Narkis",
    value: "'Narkis', 'Times New Roman', serif",
  },
];

const SIZE_OPTIONS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48, 72,
];

// פונקציה משותפת לבניית style לתמונה/וידאו
function buildMediaStyle(width, align = "center") {
  const w = width || "100%";

  let ml = "auto";
  let mr = "auto";

  switch (align) {
    case "right":
      ml = "auto";
      mr = "0";
      break;
    case "left":
      ml = "0";
      mr = "auto";
      break;
    case "center":
    default:
      ml = "auto";
      mr = "auto";
      break;
  }

  return `max-width:${w};height:auto;display:block;margin-left:${ml};margin-right:${mr};`;
}

export default function VlogRichTextEditor({ value, onChange }) {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      TextStyle,
      FontFamily.configure({
        types: ["textStyle"],
      }),
      FontSize.configure({
        types: ["textStyle"],
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "right",
      }),
      CustomImage.configure({
        HTMLAttributes: {
          class: "vlog-body-image",
        },
      }),
      CustomVideo,
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "כאן כותבים את תוכן הוולוג…",
      }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange(html);
    },
  });

  // סנכרון תוכן חיצוני (עריכת וולוג קיים)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || "") !== current) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  if (!editor) return null;

  const textAttrs = editor.getAttributes("textStyle") || {};
  const currentSize = (textAttrs.fontSize || "").replace("px", "");
  const currentFont = textAttrs.fontFamily || "";

  // ---------- תמונה ----------

  async function handleImageFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || (!json.url && !json.relativeUrl)) {
        throw new Error(json.error || "שגיאה בהעלאת תמונה");
      }

      const url = json.relativeUrl || json.url;

      editor
        .chain()
        .focus()
        .setImage({
          src: url,
          alt: "",
          "data-size": "large",
          "data-align": "center",
          style: buildMediaStyle("100%", "center"),
        })
        .run();
    } catch (err) {
      console.error(err);
      alert(err.message || "שגיאה בהעלאת תמונה");
    } finally {
      e.target.value = "";
    }
  }

  function setImageSize(mode) {
    if (!editor) return;

    const sizes = {
      xsmall: "20%", // ממש קטנה
      small: "35%",
      medium: "60%",
      large: "100%",
    };

    const attrs = editor.getAttributes("image") || {};
    const align = attrs["data-align"] || "center";
    const width = sizes[mode] || "100%";

    editor
      .chain()
      .focus()
      .updateAttributes("image", {
        "data-size": mode,
        "data-align": align,
        style: buildMediaStyle(width, align),
      })
      .run();
  }

  function setImageAlign(align) {
    if (!editor) return;

    const sizes = {
      xsmall: "20%",
      small: "35%",
      medium: "60%",
      large: "100%",
    };

    const attrs = editor.getAttributes("image") || {};
    const sizeMode = attrs["data-size"] || "medium";
    const width = sizes[sizeMode] || "60%";

    editor
      .chain()
      .focus()
      .updateAttributes("image", {
        "data-size": sizeMode,
        "data-align": align,
        style: buildMediaStyle(width, align),
      })
      .run();
  }

  // ---------- וידאו ----------

  async function handleVideoFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || (!json.url && !json.relativeUrl)) {
        throw new Error(json.error || "שגיאה בהעלאת וידאו");
      }

      const url = json.relativeUrl || json.url;

      editor
        .chain()
        .focus()
        .setVideoBlock({
          src: url,
          controls: true,
          "data-size": "large",
          "data-align": "center",
          style: buildMediaStyle("100%", "center"),
        })
        .run();
    } catch (err) {
      console.error(err);
      alert(err.message || "שגיאה בהעלאת וידאו");
    } finally {
      e.target.value = "";
    }
  }

  function setVideoSize(mode) {
    if (!editor) return;

    const sizes = {
      xsmall: "20%",
      small: "35%",
      medium: "60%",
      large: "100%",
    };

    const attrs = editor.getAttributes("videoBlock") || {};
    const align = attrs["data-align"] || "center";
    const width = sizes[mode] || "100%";

    editor
      .chain()
      .focus()
      .updateAttributes("videoBlock", {
        "data-size": mode,
        "data-align": align,
        style: buildMediaStyle(width, align),
      })
      .run();
  }

  function setVideoAlign(align) {
    if (!editor) return;

    const sizes = {
      xsmall: "20%",
      small: "35%",
      medium: "60%",
      large: "100%",
    };

    const attrs = editor.getAttributes("videoBlock") || {};
    const sizeMode = attrs["data-size"] || "medium";
    const width = sizes[sizeMode] || "60%";

    editor
      .chain()
      .focus()
      .updateAttributes("videoBlock", {
        "data-size": sizeMode,
        "data-align": align,
        style: buildMediaStyle(width, align),
      })
      .run();
  }

  return (
    <div className="rte-wrapper">
      {/* סרגל כלים */}
  <div className="rte-toolbar">
  {/* גופן */}

{/* גודל טקסט */}
<select
  className="rte-select rte-select-size"
  value={currentSize || ""}
  title="שינוי גודל הטקסט"
  onChange={(e) => {
    const val = e.target.value;
    if (!val) return;
    editor.chain().focus().setFontSize(`${val}px`).run();
  }}
>
  <option value="">גודל</option>
  {SIZE_OPTIONS.map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
  ))}
</select>

{/* גופן */}
<select
  className="rte-select rte-select-font"
  value={currentFont}
  title="בחירת גופן (פונט) לטקסט"
  onChange={(e) => {
    const val = e.target.value;
    const chain = editor.chain().focus();
    if (!val) {
      if (typeof chain.unsetFontFamily === "function") {
        chain.unsetFontFamily().run();
      } else {
        chain.setFontFamily(null).run();
      }
    } else {
      chain.setFontFamily(val).run();
    }
  }}
>
  {FONT_OPTIONS.map((f) => (
    <option key={f.label} value={f.value}>
      {f.label}
    </option>
  ))}
</select>


  <span className="rte-sep" />

  {/* עיצוב בסיסי */}
  <button
    type="button"
    title="הדגשה (Bold)"
    onClick={() => editor.chain().focus().toggleBold().run()}
    className={editor.isActive("bold") ? "is-active" : ""}
  >
    𝐁
  </button>
  <button
    type="button"
    title="כתב נטוי (Italic)"
    onClick={() => editor.chain().focus().toggleItalic().run()}
    className={editor.isActive("italic") ? "is-active" : ""}
  >
    𝘐
  </button>
  <button
    type="button"
    title="קו תחתון (Underline)"
    onClick={() => editor.chain().focus().toggleUnderline?.().run()}
  >
    U̲
  </button>
  <button
    type="button"
    title="קו חוצה (Strike)"
    onClick={() => editor.chain().focus().toggleStrike().run()}
    className={editor.isActive("strike") ? "is-active" : ""}
  >
    S̶
  </button>

  <span className="rte-sep" />

  {/* רשימות */}
  <button
    type="button"
    title="רשימת נקודות"
    onClick={() => editor.chain().focus().toggleBulletList().run()}
    className={editor.isActive("bulletList") ? "is-active" : ""}
  >
    • • •
  </button>
  <button
    type="button"
    title="רשימה ממוספרת"
    onClick={() => editor.chain().focus().toggleOrderedList().run()}
    className={editor.isActive("orderedList") ? "is-active" : ""}
  >
    1 2 3
  </button>

  <span className="rte-sep" />

  {/* כותרת / טקסט רגיל */}
  <button
    type="button"
    title="המרה לכותרת"
    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
    className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
  >
    H₂
  </button>
  <button
    type="button"
    title="טקסט רגיל (פסקה)"
    onClick={() => editor.chain().focus().setParagraph().run()}
    className={editor.isActive("paragraph") ? "is-active" : ""}
  >
    Ab
  </button>

  <span className="rte-sep" />

  {/* יישור טקסט */}
  <button
    type="button"
    title="יישור לימין"
    onClick={() => editor.chain().focus().setTextAlign("right").run()}
    className={editor.isActive({ textAlign: "right" }) ? "is-active" : ""}
  >
   ⇢
  </button>
  <button
    type="button"
    title="יישור למרכז"
    onClick={() => editor.chain().focus().setTextAlign("center").run()}
    className={editor.isActive({ textAlign: "center" }) ? "is-active" : ""}
  >
    ⇤⇥
  </button>
  <button
    type="button"
    title="יישור לשמאל"
    onClick={() => editor.chain().focus().setTextAlign("left").run()}
    className={editor.isActive({ textAlign: "left" }) ? "is-active" : ""}
  >
     ⇠
  </button>

  <span className="rte-sep" />

  {/* 🖼 תמונה */}
  <button
    type="button"
    title="הוספת תמונה"
    onClick={() => imageInputRef.current?.click()}
  >
   IMG
  </button>
  <input
    ref={imageInputRef}
    type="file"
    accept="image/*"
    style={{ display: "none" }}
    onChange={handleImageFileChange}
  />

 

  {/* גדלי תמונה */}
  <button
    type="button"
    title="תמונה קטנה מאוד"
    onClick={() => setImageSize("xsmall")}
  >
    SX
  </button>
  <button
    type="button"
    title="תמונה קטנה"
    onClick={() => setImageSize("small")}
  >
    S
  </button>
  <button
    type="button"
    title="תמונה בינונית"
    onClick={() => setImageSize("medium")}
  >
    M
  </button>
  <button
    type="button"
    title="תמונה גדולה (רוחב מלא)"
    onClick={() => setImageSize("large")}
  >
    L
  </button>

  <span className="rte-sep" />

  {/* יישור תמונה */}
  <button
    type="button"
    title="תמונה לימין"
    onClick={() => setImageAlign("right")}
  >
     ⇢
  </button>
  <button
    type="button"
    title="תמונה במרכז"
    onClick={() => setImageAlign("center")}
  >
    ⇤⇥
  </button>
  <button
    type="button"
    title="תמונה לשמאל"
    onClick={() => setImageAlign("left")}
  >
   ⇠
  </button>

  <span className="rte-sep" />

 {/* 🎥 וידאו */}
  <button
    type="button"
    title="הוספת וידאו"
    onClick={() => videoInputRef.current?.click()}
    style={{ marginInlineStart: 8 }}
  >
    VID
  </button>
  <input
    ref={videoInputRef}
    type="file"
    accept="video/*"
    style={{ display: "none" }}
    onChange={handleVideoFileChange}
  />


  {/* גדלי וידאו */}
  <button
    type="button"
    title="וידאו קטן מאוד"
    onClick={() => setVideoSize("xsmall")}
  >
    SX
  </button>
  <button
    type="button"
    title="וידאו קטן"
    onClick={() => setVideoSize("small")}
  >
    S
  </button>
  <button
    type="button"
    title="וידאו בינוני"
    onClick={() => setVideoSize("medium")}
  >
     M
  </button>
  <button
    type="button"
    title="וידאו גדול (רוחב מלא)"
    onClick={() => setVideoSize("large")}
  >
     L
  </button>

  <span className="rte-sep" />

  {/* יישור וידאו */}
  <button
    type="button"
    title="וידאו לימין"
    onClick={() => setVideoAlign("right")}
  >
    ⇢
  </button>
  <button
    type="button"
    title="וידאו במרכז"
    onClick={() => setVideoAlign("center")}
  >
    ⇤⇥
  </button>
  <button
    type="button"
    title="וידאו לשמאל"
    onClick={() => setVideoAlign("left")}
  >
    ⇠
  </button>
</div>

      {/* אזור העריכה עצמו */}
      <EditorContent className="rte-editor" editor={editor} />
    </div>
  );
}
