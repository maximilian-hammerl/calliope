/* @ds-bundle: {"format":4,"namespace":"CalliopeDesignSystem_d27ed6","components":[{"name":"FileList","sourcePath":"components/context/FileList.jsx"},{"name":"MemberList","sourcePath":"components/context/MemberList.jsx"},{"name":"StepList","sourcePath":"components/context/StepList.jsx"},{"name":"StoryStatus","sourcePath":"components/context/StoryStatus.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Label","sourcePath":"components/core/Label.jsx"},{"name":"PanelCard","sourcePath":"components/core/PanelCard.jsx"},{"name":"SearchField","sourcePath":"components/core/SearchField.jsx"},{"name":"GroupList","sourcePath":"components/navigation/GroupList.jsx"},{"name":"RailToggle","sourcePath":"components/navigation/RailToggle.jsx"},{"name":"ThreadTabs","sourcePath":"components/navigation/ThreadTabs.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"},{"name":"Composer","sourcePath":"components/thread/Composer.jsx"},{"name":"GroupHeader","sourcePath":"components/thread/GroupHeader.jsx"},{"name":"NotesThread","sourcePath":"components/thread/NotesThread.jsx"},{"name":"Post","sourcePath":"components/thread/Post.jsx"},{"name":"ThreadHeader","sourcePath":"components/thread/ThreadHeader.jsx"}],"sourceHashes":{"components/context/FileList.jsx":"e455ac6c9816","components/context/MemberList.jsx":"f931f18f9af5","components/context/StepList.jsx":"a0f90d412774","components/context/StoryStatus.jsx":"a2f3abdbfe9f","components/core/Avatar.jsx":"9527d74f98bb","components/core/Badge.jsx":"f32c343218de","components/core/Button.jsx":"a08d1742dc0e","components/core/Label.jsx":"95595323556c","components/core/PanelCard.jsx":"1049218900ad","components/core/SearchField.jsx":"774bf669584e","components/navigation/GroupList.jsx":"eab9bd65f418","components/navigation/RailToggle.jsx":"a0fde16d4f83","components/navigation/ThreadTabs.jsx":"3facc86e494e","components/navigation/TopBar.jsx":"6789bfcea291","components/thread/Composer.jsx":"bb9870eef8fc","components/thread/GroupHeader.jsx":"5e1e8666939b","components/thread/NotesThread.jsx":"30a647672a35","components/thread/Post.jsx":"af6dc43f1f1a","components/thread/ThreadHeader.jsx":"b900a56ced25","ui_kits/app_desktop/CreateGroupDialog.jsx":"4f5ae309975a","ui_kits/app_desktop/GroupsIndex.jsx":"41fdd99d7f84","ui_kits/app_desktop/ThreadPage.jsx":"3ccb943132c0","ui_kits/app_mobile/MobileThread.jsx":"b547093bbdd3"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.CalliopeDesignSystem_d27ed6 = window.CalliopeDesignSystem_d27ed6 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/context/FileList.jsx
try { (() => {
function FileList({
  files = [],
  total,
  onAll,
  title = "Dateien & Bilder",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-4)",
      marginBottom: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-control)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-secondary)"
    }
  }, title), total != null && onAll && /*#__PURE__*/React.createElement("button", {
    onClick: onAll,
    style: {
      marginLeft: "auto",
      font: "var(--text-hint)",
      color: "var(--text-muted)",
      background: "none",
      border: "none",
      padding: 0,
      cursor: "pointer"
    }
  }, "alle ", total)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      font: "var(--text-control)",
      color: "var(--text-secondary)"
    }
  }, files.map(file => /*#__PURE__*/React.createElement("div", {
    key: file.name,
    style: {
      display: "flex",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-filetype)",
      color: "var(--text-meta)",
      textTransform: "uppercase"
    }
  }, file.type), file.name))));
}
Object.assign(__ds_scope, { FileList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/context/FileList.jsx", error: String((e && e.message) || e) }); }

// components/context/StoryStatus.jsx
try { (() => {
function StoryStatus({
  fields = [],
  title = "Story-Status",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-control)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-secondary)",
      marginBottom: "var(--space-4)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-control)",
      color: "var(--text-secondary)",
      lineHeight: "var(--leading-panel)"
    }
  }, fields.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.label
  }, f.label, ": ", f.strong ? /*#__PURE__*/React.createElement("strong", {
    style: {
      fontWeight: "var(--weight-semibold)"
    }
  }, f.value) : f.value))));
}
Object.assign(__ds_scope, { StoryStatus });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/context/StoryStatus.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizes = {
  sm: 22,
  md: 28,
  lg: 34
};
function Avatar({
  name = "",
  size = "md",
  style,
  ...rest
}) {
  const px = sizes[size] || sizes.md;
  const initial = name.trim().charAt(0).toUpperCase();
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": !name || undefined,
    title: name || undefined,
    style: {
      width: px,
      height: px,
      flex: "none",
      borderRadius: "var(--radius-circle)",
      background: "var(--surface-avatar)",
      color: "#5c4a2d",
      font: `var(--weight-semibold) ${Math.round(px * 0.41)}px/${px}px var(--font-ui)`,
      textAlign: "center",
      ...style
    }
  }, rest), initial);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Badge({
  children,
  variant = "label",
  style,
  ...rest
}) {
  const variants = {
    // Uppercase mono badge: group visibility ("Privat")
    label: {
      font: "var(--text-label)",
      letterSpacing: "var(--label-tracking)",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      border: "1px solid var(--border-default)",
      padding: "4px 7px"
    },
    // Sentence-case state tag on a post ("gemerkt")
    tag: {
      font: "var(--text-hint)",
      color: "var(--text-muted)",
      border: "1px solid var(--border-strong)",
      padding: "2px 6px"
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-block",
      borderRadius: "var(--radius-tag)",
      whiteSpace: "nowrap",
      ...variants[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const base = {
  font: "var(--text-control)",
  borderRadius: "var(--radius-control)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-3)",
  textDecoration: "none",
  boxSizing: "border-box",
  transition: "background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease)"
};
const levels = {
  solid: {
    background: "var(--action-solid-bg)",
    color: "var(--action-solid-fg)",
    border: "1px solid var(--action-solid-bg)",
    hover: {
      background: "var(--action-solid-bg-hover)",
      borderColor: "var(--action-solid-bg-hover)"
    }
  },
  quiet: {
    background: "var(--action-quiet-bg)",
    color: "var(--action-quiet-fg)",
    border: "1px solid var(--action-quiet-border)",
    fontWeight: "var(--weight-medium)",
    hover: {
      background: "var(--paper-4)"
    }
  },
  outline: {
    background: "var(--surface-raised)",
    color: "var(--action-quiet-fg)",
    border: "1px solid var(--border-default)",
    hover: {
      background: "var(--paper-1)"
    }
  },
  plain: {
    background: "transparent",
    color: "var(--action-plain-fg)",
    border: "1px solid transparent",
    padding: 0,
    hover: {
      color: "var(--text-secondary)"
    }
  }
};
const sizes = {
  sm: {
    padding: "5px 10px"
  },
  md: {
    padding: "7px 12px"
  },
  lg: {
    padding: "8px 16px"
  }
};
function Button({
  children,
  level = "quiet",
  size = "md",
  block = false,
  disabled = false,
  onClick,
  type = "button",
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const l = levels[level] || levels.quiet;
  const {
    hover: hoverStyle,
    ...levelStyle
  } = l;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...base,
      ...(level === "plain" ? {} : sizes[size]),
      ...levelStyle,
      justifyContent: block ? "center" : undefined,
      width: block ? "100%" : undefined,
      minHeight: level === "plain" ? undefined : "var(--tap-min-desktop, auto)",
      ...(hover && !disabled ? hoverStyle : null),
      ...(disabled ? {
        background: "var(--paper-2)",
        color: "var(--ink-6)",
        cursor: "default"
      } : null),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/context/MemberList.jsx
try { (() => {
function MemberList({
  members = [],
  onInvite,
  inviteLabel = "Mitglied einladen",
  title = "Mitglieder",
  sticky = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: sticky ? "auto" : undefined,
      position: sticky ? "sticky" : "static",
      bottom: sticky ? -16 : undefined,
      background: "var(--surface-rail)",
      borderTop: sticky ? "1px solid var(--border-subtle)" : "none",
      paddingTop: "var(--space-7)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-control)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-secondary)",
      marginBottom: "var(--space-5)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-control)",
      lineHeight: "var(--leading-panel)",
      color: "var(--text-secondary)"
    }
  }, members.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.name
  }, m.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-meta)"
    }
  }, "\xB7 ", m.role)))), onInvite && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "var(--space-5) 0 2px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    level: "quiet",
    block: true,
    onClick: onInvite
  }, inviteLabel)));
}
Object.assign(__ds_scope, { MemberList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/context/MemberList.jsx", error: String((e && e.message) || e) }); }

// components/core/Label.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Label({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      font: "var(--text-label)",
      letterSpacing: "var(--label-tracking)",
      textTransform: "uppercase",
      color: "var(--text-label)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Label.jsx", error: String((e && e.message) || e) }); }

// components/core/PanelCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function PanelCard({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--surface-raised)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-control)",
      padding: "9px var(--space-5)",
      font: "var(--text-control)",
      color: "var(--text-secondary)",
      boxShadow: "var(--shadow-none)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { PanelCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/PanelCard.jsx", error: String((e && e.message) || e) }); }

// components/context/StepList.jsx
try { (() => {
function StepList({
  steps = [],
  onToggle,
  onAdd,
  doneOpen = false,
  onToggleDone,
  visibleCount = 4,
  title = "Nächste Schritte",
  style
}) {
  const open = steps.filter(s => !s.done);
  const done = steps.filter(s => s.done);
  const rowHeight = 46;
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-4)",
      marginBottom: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-control)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-secondary)"
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-hint)",
      color: "var(--text-muted)"
    }
  }, open.length, " offen")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      maxHeight: visibleCount ? visibleCount * rowHeight : "none",
      overflowY: open.length > visibleCount ? "auto" : "visible"
    }
  }, open.map(s => /*#__PURE__*/React.createElement(__ds_scope.PanelCard, {
    key: s.id,
    onClick: () => onToggle && onToggle(s.id),
    style: {
      display: "flex",
      gap: "var(--space-4)",
      alignItems: "flex-start",
      cursor: onToggle ? "pointer" : "default"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-meta)"
    }
  }, "\u2610"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, s.text, s.author && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-meta)",
      font: "var(--text-hint)"
    }
  }, "von ", s.author))))), !open.length && /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-hint)",
      color: "var(--text-muted)"
    }
  }, "Nichts offen.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)",
      marginTop: "9px"
    }
  }, onAdd && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    level: "quiet",
    size: "sm",
    onClick: onAdd
  }, "\uFF0B Schritt"), done.length > 0 && onToggleDone && /*#__PURE__*/React.createElement("span", {
    onClick: onToggleDone,
    style: {
      cursor: "pointer",
      font: "var(--text-control)",
      color: "var(--text-muted)"
    }
  }, "Erledigt (", done.length, ") ", doneOpen ? "▾" : "▸")), doneOpen && done.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      marginTop: "var(--space-4)",
      font: "var(--text-action)",
      color: "var(--text-meta)"
    }
  }, done.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    onClick: () => onToggle && onToggle(s.id),
    style: {
      textDecoration: "line-through",
      cursor: onToggle ? "pointer" : "default"
    }
  }, s.text))));
}
Object.assign(__ds_scope, { StepList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/context/StepList.jsx", error: String((e && e.message) || e) }); }

// components/core/SearchField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SearchField({
  value,
  onChange,
  placeholder = "Suche",
  width = 210,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)",
      width,
      height: 30,
      boxSizing: "border-box",
      padding: "0 var(--space-5)",
      background: "var(--paper-1)",
      border: `1px solid ${focus ? "var(--focus-ring)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-control)",
      font: "var(--text-control)",
      color: "var(--text-muted)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\u2315"), /*#__PURE__*/React.createElement("input", _extends({
    type: "search",
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      font: "var(--text-control)",
      color: "var(--text-title)"
    }
  }, rest)));
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/navigation/GroupList.jsx
try { (() => {
function GroupList({
  groups = [],
  activeId,
  onSelect,
  onCreate,
  createLabel = "＋ Gruppe gründen",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-1)",
      ...style
    }
  }, groups.map(g => {
    const on = g.id === activeId;
    return /*#__PURE__*/React.createElement("a", {
      key: g.id,
      href: "#",
      onClick: e => {
        e.preventDefault();
        onSelect && onSelect(g.id);
      },
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: "var(--space-4)",
        padding: "9px var(--space-5)",
        font: "var(--text-row)",
        textDecoration: "none",
        boxSizing: "border-box",
        minHeight: 34,
        color: on ? "var(--text-title)" : "var(--text-secondary)",
        fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
        background: on ? "var(--surface-raised)" : "transparent",
        border: `1px solid ${on ? "var(--border-strong)" : "transparent"}`,
        borderRadius: "var(--radius-control)"
      }
    }, /*#__PURE__*/React.createElement("span", null, g.name), g.unread ? /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        font: "var(--text-hint)",
        color: "var(--text-muted)",
        whiteSpace: "nowrap"
      }
    }, g.unread, " neu") : null);
  }), onCreate && /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onCreate();
    },
    style: {
      marginTop: "var(--space-4)",
      padding: "9px var(--space-5)",
      textAlign: "center",
      font: "var(--text-control)",
      fontWeight: "var(--weight-medium)",
      color: "var(--action-quiet-fg)",
      background: "var(--action-quiet-bg)",
      border: "1px solid var(--action-quiet-border)",
      borderRadius: "var(--radius-control)",
      textDecoration: "none"
    }
  }, createLabel));
}
Object.assign(__ds_scope, { GroupList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/GroupList.jsx", error: String((e && e.message) || e) }); }

// components/navigation/RailToggle.jsx
try { (() => {
function RailToggle({
  side = "left",
  label,
  onClick,
  style
}) {
  const isLeft = side === "left";
  return /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    onClick: onClick,
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick && onClick();
      }
    },
    title: `${label} einblenden`,
    style: {
      flex: "none",
      width: "var(--rail-collapsed-w)",
      boxSizing: "border-box",
      background: "var(--surface-edge)",
      [isLeft ? "borderRight" : "borderLeft"]: "1px solid var(--border-subtle)",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: "var(--space-8)",
      gap: "var(--space-7)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--text-label)"
    }
  }, isLeft ? "›" : "‹"), /*#__PURE__*/React.createElement("span", {
    style: {
      writingMode: "vertical-rl",
      font: "var(--text-label)",
      letterSpacing: ".14em",
      textTransform: "uppercase",
      color: "var(--text-label)"
    }
  }, label));
}
Object.assign(__ds_scope, { RailToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/RailToggle.jsx", error: String((e && e.message) || e) }); }

// components/navigation/ThreadTabs.jsx
try { (() => {
function ThreadTabs({
  threads = [],
  activeId,
  onSelect,
  onCreate,
  createLabel = "＋ Thread",
  sticky = true,
  gutter = "var(--thread-gutter)",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `15px ${gutter} 0`,
      position: sticky ? "sticky" : "static",
      top: 0,
      zIndex: 2,
      background: "var(--surface-app)",
      boxShadow: "0 1px 0 var(--border-subtle)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "calliope-scroll-x",
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-9)",
      whiteSpace: "nowrap",
      font: "var(--text-tab)"
    }
  }, threads.map(t => {
    const on = t.id === activeId;
    return /*#__PURE__*/React.createElement("a", {
      key: t.id,
      href: "#",
      onClick: e => {
        e.preventDefault();
        onSelect && onSelect(t.id);
      },
      style: {
        flex: "none",
        textDecoration: "none",
        padding: "0 0 11px",
        color: on ? "var(--text-title)" : "var(--text-muted)",
        fontWeight: on ? "var(--weight-medium)" : "var(--weight-regular)",
        borderBottom: `2px solid ${on ? "var(--tab-active-underline)" : "transparent"}`
      }
    }, t.name);
  }), onCreate && /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onCreate();
    },
    style: {
      flex: "none",
      textDecoration: "none",
      padding: "0 0 11px",
      color: "var(--ink-5)",
      borderBottom: "2px solid transparent"
    }
  }, createLabel)));
}
Object.assign(__ds_scope, { ThreadTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/ThreadTabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
function TopBar({
  items = ["Startseite", "Forum", "Schreibpartner", "Meine Gruppen", "Nachrichten"],
  active = "Meine Gruppen",
  onSelect,
  user = "Alice",
  query,
  onQueryChange,
  compact = false,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: compact ? "var(--space-4)" : "var(--space-11)",
      padding: `0 ${compact ? "var(--space-7)" : "var(--space-10)"}`,
      height: compact ? "var(--topbar-h-mobile)" : "var(--topbar-h)",
      boxSizing: "border-box",
      background: "var(--surface-raised)",
      borderBottom: "1px solid var(--border-subtle)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-wordmark)",
      color: "#3a3229",
      letterSpacing: ".01em"
    }
  }, "Calliope"), !compact && /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: "var(--space-9)",
      font: "var(--text-nav)"
    }
  }, items.map(it => {
    const on = it === active;
    return /*#__PURE__*/React.createElement("a", {
      key: it,
      href: "#",
      onClick: e => {
        e.preventDefault();
        onSelect && onSelect(it);
      },
      style: {
        textDecoration: "none",
        color: on ? "var(--text-title)" : "var(--text-muted)",
        fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
        boxShadow: on ? "inset 0 -2px 0 var(--tab-active-underline)" : "none",
        paddingBottom: on ? 17 : 0
      }
    }, it);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-7)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SearchField, {
    value: query,
    onChange: onQueryChange,
    width: compact ? 120 : 210
  }), /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: user
  })));
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// components/thread/Composer.jsx
try { (() => {
const TOOLS = ["B", "I", '„"', "Liste", "Bild", "Datei"];
function Composer({
  value = "",
  onChange,
  onSubmit,
  onPreview,
  saveState = "saved",
  collapsed = false,
  onToggleCollapse,
  submitting = false,
  label = "Weiterschreiben",
  submitLabel = "Beitrag senden",
  gutter = "var(--thread-gutter)",
  maxWidth = "var(--reading-max)",
  style
}) {
  const saveText = saveState === "saving" ? "Entwurf wird gespeichert" : saveState === "saved" ? "Entwurf gespeichert" : null;
  if (collapsed) {
    return /*#__PURE__*/React.createElement("div", {
      onClick: onToggleCollapse,
      style: {
        flex: "none",
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--surface-raised)",
        padding: `13px ${gutter}`,
        cursor: "pointer",
        ...style
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-6)",
        font: "var(--text-control)",
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: "var(--weight-semibold)",
        color: "var(--text-secondary)"
      }
    }, label), saveText && /*#__PURE__*/React.createElement("span", null, saveText), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        color: "var(--action-quiet-fg)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-control)",
        padding: "4px 9px"
      }
    }, "Editor ausklappen \u2303")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      borderTop: "1px solid var(--border-subtle)",
      background: "var(--surface-raised)",
      padding: `13px ${gutter} var(--space-8)`,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-7)",
      marginBottom: "var(--space-5)",
      font: "var(--text-control)",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-secondary)"
    }
  }, label), saveState === "saving" && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      border: "1.5px solid var(--border-strong)",
      borderTopColor: "var(--accent)",
      display: "inline-block",
      animation: "calliope-spin var(--spinner-duration) linear infinite"
    }
  }), "Entwurf wird gespeichert"), saveState === "saved" && /*#__PURE__*/React.createElement("span", null, "Entwurf gespeichert"), onToggleCollapse && /*#__PURE__*/React.createElement("span", {
    onClick: onToggleCollapse,
    style: {
      marginLeft: "auto",
      cursor: "pointer",
      color: "var(--action-quiet-fg)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-control)",
      padding: "4px 9px"
    }
  }, "Editor einklappen \u2304")), /*#__PURE__*/React.createElement("textarea", {
    value: value,
    onChange: onChange,
    rows: 3,
    style: {
      width: "100%",
      boxSizing: "border-box",
      minHeight: 76,
      border: "none",
      outline: "none",
      resize: "vertical",
      background: "transparent",
      font: "var(--text-composer)",
      color: "var(--text-draft)",
      caretColor: "var(--caret)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-7)",
      borderTop: "1px solid var(--border-hairline)",
      paddingTop: "11px",
      marginTop: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "15px",
      font: "var(--text-control)",
      color: "var(--text-muted)"
    }
  }, TOOLS.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontWeight: i === 0 ? 600 : 400,
      fontStyle: i === 1 ? "italic" : "normal",
      cursor: "pointer"
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-5)",
      alignItems: "center"
    }
  }, onPreview && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    level: "outline",
    onClick: onPreview
  }, "Vorschau"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    level: "solid",
    size: "lg",
    onClick: onSubmit,
    disabled: submitting
  }, submitting ? "Wird gesendet …" : submitLabel)))));
}
Object.assign(__ds_scope, { Composer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/thread/Composer.jsx", error: String((e && e.message) || e) }); }

// components/thread/GroupHeader.jsx
try { (() => {
function GroupHeader({
  name,
  visibility = "Privat",
  threadCount,
  threadLimit,
  gutter = "var(--thread-gutter)",
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `var(--space-9) ${gutter} 0`,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-6)",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: "var(--text-h1)",
      color: "var(--text-title)"
    }
  }, name), visibility && /*#__PURE__*/React.createElement(__ds_scope.Badge, null, visibility), threadCount != null && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-hint)",
      color: "var(--text-muted)",
      whiteSpace: "nowrap"
    }
  }, threadLimit != null ? `${threadCount} von ${threadLimit} Threads` : `${threadCount} Threads`), children));
}
Object.assign(__ds_scope, { GroupHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/thread/GroupHeader.jsx", error: String((e && e.message) || e) }); }

// components/thread/NotesThread.jsx
try { (() => {
function NotesThread({
  notes = [],
  onWrite,
  writeLabel = "Anmerkung schreiben",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-7)",
      paddingLeft: "var(--space-8)",
      borderLeft: "2px solid var(--border-strong)",
      display: "flex",
      flexDirection: "column",
      gap: "11px",
      ...style
    }
  }, notes.map((n, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      font: "var(--text-row)",
      color: "var(--text-draft)",
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: "var(--weight-semibold)"
    }
  }, n.author), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-meta)",
      font: "var(--text-hint)"
    }
  }, n.time), /*#__PURE__*/React.createElement("br", null), n.text)), onWrite && /*#__PURE__*/React.createElement("button", {
    onClick: onWrite,
    style: {
      alignSelf: "flex-start",
      font: "var(--text-control)",
      color: "var(--action-plain-fg)",
      background: "none",
      border: "none",
      padding: 0,
      cursor: "pointer"
    }
  }, writeLabel));
}
Object.assign(__ds_scope, { NotesThread });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/thread/NotesThread.jsx", error: String((e && e.message) || e) }); }

// components/thread/Post.jsx
try { (() => {
function Post({
  author,
  time,
  edited = false,
  bookmarked = false,
  children,
  actions = ["Antworten", "Zitieren", "Merken"],
  onAction,
  notesCount,
  notesOpen = false,
  onToggleNotes,
  divider = true,
  style
}) {
  const meta = [author, time, edited ? "bearbeitet" : null].filter(Boolean).join(" · ");
  return /*#__PURE__*/React.createElement("article", {
    style: {
      padding: `var(--post-gap) 0`,
      borderBottom: divider ? "1px solid var(--border-divider)" : "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)",
      marginBottom: "9px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-meta)",
      color: "var(--text-meta)"
    }
  }, meta), bookmarked && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: "tag"
  }, "gemerkt")), /*#__PURE__*/React.createElement("div", {
    className: "calliope-prose"
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-8)",
      marginTop: "var(--space-7)",
      font: "var(--text-action)",
      color: "var(--action-plain-fg)"
    }
  }, notesCount ? /*#__PURE__*/React.createElement("button", {
    onClick: onToggleNotes,
    style: {
      font: "var(--text-action)",
      color: "var(--action-quiet-fg)",
      background: "none",
      border: "none",
      borderBottom: "1px solid var(--border-default)",
      padding: 0,
      cursor: "pointer"
    }
  }, notesCount, " Anmerkungen", notesOpen ? "" : " anzeigen") : null, actions.map(a => /*#__PURE__*/React.createElement("button", {
    key: a,
    onClick: () => onAction && onAction(a),
    style: {
      font: "var(--text-action)",
      color: "var(--action-plain-fg)",
      background: "none",
      border: "none",
      padding: 0,
      cursor: "pointer"
    }
  }, a))));
}
Object.assign(__ds_scope, { Post });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/thread/Post.jsx", error: String((e && e.message) || e) }); }

// components/thread/ThreadHeader.jsx
try { (() => {
function ThreadHeader({
  title,
  postCount,
  lastActivity,
  lastAuthor,
  filter = "Alle Beiträge",
  onFilter,
  style
}) {
  const meta = [postCount != null ? `${postCount} Beiträge` : null, lastActivity ? `zuletzt ${lastActivity}${lastAuthor ? ` von ${lastAuthor}` : ""}` : null].filter(Boolean).join(" · ");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: "var(--space-8)",
      marginBottom: "var(--space-11)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 5px",
      font: "var(--text-h2)",
      color: "var(--text-title)"
    }
  }, title), meta && /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-control)",
      color: "var(--text-muted)"
    }
  }, meta)), onFilter && /*#__PURE__*/React.createElement("button", {
    onClick: onFilter,
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)",
      font: "var(--text-control)",
      color: "var(--action-quiet-fg)",
      background: "var(--paper-1)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-control)",
      padding: "6px 11px",
      cursor: "pointer"
    }
  }, filter, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: "var(--text-muted)"
    }
  }, "\u25BE")));
}
Object.assign(__ds_scope, { ThreadHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/thread/ThreadHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_desktop/CreateGroupDialog.jsx
try { (() => {
/* EXTRAPOLATION — no mockup exists. Built because members asked that group creation
   FORCE the standardising metadata (title, genre, perspective) so groups stay comparable. */
function CreateGroupDialog({
  onClose
}) {
  const {
    Button,
    Label,
    Badge
  } = window.DS;
  const [name, setName] = React.useState("");
  const [genres, setGenres] = React.useState([]);
  const [visibility, setVisibility] = React.useState("Privat");
  const [perspective, setPerspective] = React.useState("");
  const genreOptions = ["Fantasy", "Mystery", "Romance", "Historisch", "Science-Fiction", "Drama"];
  const ready = name.trim() && genres.length && perspective;
  const field = {
    font: "var(--text-control)",
    color: "var(--text-title)",
    background: "var(--surface-raised)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-control)",
    padding: "9px var(--space-5)",
    width: "100%",
    boxSizing: "border-box",
    outline: "none"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(43,38,32,.22)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-ui)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 480,
      background: "var(--surface-app)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-control)",
      padding: "var(--space-10)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 var(--space-3)",
      font: "var(--text-h2)",
      color: "var(--text-title)"
    }
  }, "Gruppe gr\xFCnden"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 var(--space-9)",
      font: "var(--text-control)",
      color: "var(--text-muted)",
      lineHeight: 1.6
    }
  }, "Titel, Genre und Perspektive sind Pflicht \u2014 so finden andere die Gruppe und wissen, worauf sie sich einlassen."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-9)"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Titel")), /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "z. B. Der Erinnerungsmarkt",
    style: field
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Genre")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--space-3)"
    }
  }, genreOptions.map(g => {
    const on = genres.includes(g);
    return /*#__PURE__*/React.createElement("button", {
      key: g,
      onClick: () => setGenres(s => on ? s.filter(x => x !== g) : [...s, g]),
      style: {
        font: "var(--text-control)",
        cursor: "pointer",
        borderRadius: "var(--radius-control)",
        padding: "6px 11px",
        background: on ? "var(--action-quiet-bg)" : "var(--surface-raised)",
        border: `1px solid ${on ? "var(--action-quiet-border)" : "var(--border-default)"}`,
        color: on ? "var(--action-quiet-fg)" : "var(--text-secondary)",
        fontWeight: on ? "var(--weight-medium)" : "var(--weight-regular)"
      }
    }, g);
  }))), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Perspektive")), /*#__PURE__*/React.createElement("select", {
    value: perspective,
    onChange: e => setPerspective(e.target.value),
    style: field
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Bitte w\xE4hlen"), /*#__PURE__*/React.createElement("option", null, "1. Person, Gegenwart"), /*#__PURE__*/React.createElement("option", null, "1. Person, Vergangenheit"), /*#__PURE__*/React.createElement("option", null, "3. Person, Gegenwart"), /*#__PURE__*/React.createElement("option", null, "3. Person, Vergangenheit"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Sichtbarkeit")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-3)",
      alignItems: "center"
    }
  }, ["Privat", "Öffentlich"].map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    onClick: () => setVisibility(v),
    style: {
      font: "var(--text-control)",
      cursor: "pointer",
      borderRadius: "var(--radius-control)",
      padding: "6px 11px",
      background: visibility === v ? "var(--action-quiet-bg)" : "var(--surface-raised)",
      border: `1px solid ${visibility === v ? "var(--action-quiet-border)" : "var(--border-default)"}`,
      color: visibility === v ? "var(--action-quiet-fg)" : "var(--text-secondary)"
    }
  }, v)), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-hint)",
      color: "var(--text-muted)",
      marginLeft: "var(--space-3)"
    }
  }, visibility === "Privat" ? "Nur eingeladene Mitglieder sehen die Gruppe." : "Die Gruppe erscheint in der Suche.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-5)",
      marginTop: "var(--space-11)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    level: "outline",
    onClick: onClose
  }, "Abbrechen"), /*#__PURE__*/React.createElement(Button, {
    level: "solid",
    size: "lg",
    disabled: !ready,
    onClick: onClose
  }, "Gruppe gr\xFCnden"), !ready && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-hint)",
      color: "var(--text-muted)"
    }
  }, "Titel, Genre und Perspektive fehlen noch."))));
}
window.Kit = Object.assign(window.Kit || {}, {
  CreateGroupDialog
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_desktop/CreateGroupDialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_desktop/GroupsIndex.jsx
try { (() => {
/* EXTRAPOLATION — no mockup exists for this screen. It reuses only tested patterns:
   left rail group list, Newsreader 400 headings, hairline rows, quiet actions. */
function GroupsIndex({
  onOpenGroup,
  onCreateGroup
}) {
  const {
    TopBar,
    GroupList,
    Label,
    Badge,
    Button
  } = window.DS;
  const groups = [{
    id: "em",
    name: "Der Erinnerungsmarkt",
    visibility: "Privat",
    members: "Alice, Bob, Carol",
    status: "Wird geschrieben",
    last: "vor 12 Minuten von Bob",
    threads: 6
  }, {
    id: "ka",
    name: "Königreich aus Asche",
    visibility: "Privat",
    members: "Alice, Dora",
    status: "Wird geschrieben",
    last: "gestern von Dora",
    threads: 9
  }, {
    id: "mr",
    name: "Mondlicht & Rosen",
    visibility: "Öffentlich",
    members: "Alice, Bob, Erik, Fee",
    status: "Pause",
    last: "12. Februar von Erik",
    threads: 3
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "var(--surface-app)",
      fontFamily: "var(--font-ui)"
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    active: "Meine Gruppen"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      flex: "none",
      width: "var(--rail-left-w)",
      boxSizing: "border-box",
      background: "var(--surface-rail)",
      borderRight: "1px solid var(--border-subtle)",
      padding: "16px 11px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 5px 9px"
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Meine Gruppen")), /*#__PURE__*/React.createElement(GroupList, {
    groups: groups,
    activeId: "",
    onSelect: onOpenGroup,
    onCreate: onCreateGroup
  })), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0,
      overflow: "auto",
      padding: "var(--space-9) var(--thread-gutter) var(--space-12)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 var(--space-9)",
      font: "var(--text-h1)",
      color: "var(--text-title)"
    }
  }, "Meine Gruppen"), groups.map((g, i) => /*#__PURE__*/React.createElement("div", {
    key: g.id,
    style: {
      padding: "var(--post-gap) 0",
      borderTop: i ? "1px solid var(--border-divider)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onOpenGroup && onOpenGroup(g.id);
    },
    style: {
      font: "var(--text-h2)",
      color: "var(--text-title)",
      textDecoration: "none"
    }
  }, g.name), /*#__PURE__*/React.createElement(Badge, null, g.visibility), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-hint)",
      color: "var(--text-muted)"
    }
  }, g.threads, " Threads")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-control)",
      color: "var(--text-muted)",
      marginTop: "var(--space-3)",
      lineHeight: "var(--leading-panel)"
    }
  }, g.members, /*#__PURE__*/React.createElement("br", null), "Status: ", g.status, " \xB7 zuletzt ", g.last), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    level: "outline",
    size: "sm",
    onClick: () => onOpenGroup && onOpenGroup(g.id)
  }, "Gruppe \xF6ffnen"))))))));
}
window.Kit = Object.assign(window.Kit || {}, {
  GroupsIndex
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_desktop/GroupsIndex.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_desktop/ThreadPage.jsx
try { (() => {
/* The accepted design (mockup 3a): a private writing group's thread page. */
function ThreadPage({
  group,
  onOpenGroups,
  onCreateGroup
}) {
  const {
    TopBar,
    GroupList,
    ThreadTabs,
    RailToggle,
    GroupHeader,
    ThreadHeader,
    Post,
    NotesThread,
    Composer,
    StepList,
    MemberList,
    FileList,
    StoryStatus,
    Label
  } = window.DS;
  const threads = [{
    id: "k1",
    name: "Kapitel 1"
  }, {
    id: "k2",
    name: "Kapitel 2"
  }, {
    id: "ip",
    name: "Ideen & Planung"
  }, {
    id: "ch",
    name: "Charaktere"
  }, {
    id: "wb",
    name: "Worldbuilding"
  }, {
    id: "ag",
    name: "Allgemein"
  }];
  const seed = [{
    id: "p1",
    author: "Alice",
    time: "Dienstag, 09:14",
    paras: ["Der Markt öffnete immer erst, wenn das letzte Licht aus den Fenstern der Weberstraße gewichen war. Mira wusste das, seit sie sieben war und ihre Mutter zum ersten Mal etwas verkauft hatte, das sie danach nicht mehr benennen konnte.", "Sie zog den Kragen höher und trat zwischen die Stände. Öl, Papier, kalter Stein. Und darunter, wie immer, dieser süßliche Geruch fremder Sommer."],
    notes: [{
      author: "Bob",
      time: "vor 20 Min.",
      text: "Der zweite Absatz ist stark. „fremder Sommer“ würde ich vorne schon andeuten."
    }, {
      author: "Carol",
      time: "vor 8 Min.",
      text: "Als Leserin: der Einstieg hat mich sofort drin gehabt."
    }]
  }, {
    id: "p2",
    author: "Bob",
    time: "vor 12 Minuten",
    edited: true,
    bookmarked: true,
    paras: ["Kesh sah das Mädchen, bevor es ihn sah — daran erkannte er die Gewohnten. Wer zum ersten Mal kam, blieb am Eingang stehen und suchte ein Schild.", "„Du willst etwas verkaufen“, sagte er, ohne aufzublicken. „Alle, die so gehen, wollen verkaufen.“"]
  }, {
    id: "p3",
    author: "Alice",
    time: "vor 4 Minuten",
    paras: ["Sie hätte lügen können. Stattdessen sagte sie die Wahrheit, und das war der Fehler, den sie später nicht mehr rückgängig machen konnte."]
  }];
  const [thread, setThread] = React.useState("k1");
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [rightOpen, setRightOpen] = React.useState(true);
  const [editorOpen, setEditorOpen] = React.useState(true);
  const [openNotes, setOpenNotes] = React.useState({
    p1: true
  });
  const [posts, setPosts] = React.useState(seed);
  const [draft, setDraft] = React.useState("Mira antwortete nicht sofort. Sie zählte die Laternen, wie ihre Mutter es ihr beigebracht hatte —");
  const [saveState, setSaveState] = React.useState("saved");
  const [sending, setSending] = React.useState(false);
  const [doneOpen, setDoneOpen] = React.useState(false);
  const [steps, setSteps] = React.useState([{
    id: "s1",
    text: "Keshs Motiv festlegen",
    author: "Bob"
  }, {
    id: "s2",
    text: "Kapitel 2 anlegen",
    author: "Alice"
  }, {
    id: "s3",
    text: "Zeitleiste nachziehen",
    author: "Alice"
  }, {
    id: "s4",
    text: "Marktnamen sammeln",
    author: "Carol"
  }, {
    id: "s5",
    text: "Marktszene beginnen",
    done: true
  }, {
    id: "s6",
    text: "Mira benennen",
    done: true
  }, {
    id: "s7",
    text: "Perspektive festlegen",
    done: true
  }]);

  // Autosave: visible, continuous, never timestamped.
  React.useEffect(() => {
    if (!draft) return;
    setSaveState("saving");
    const t = setTimeout(() => setSaveState("saved"), 900);
    return () => clearTimeout(t);
  }, [draft]);

  // Submitting locks the button: a flaky connection must not produce a double post.
  function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setTimeout(() => {
      setPosts(p => [...p, {
        id: "n" + p.length,
        author: "Alice",
        time: "gerade eben",
        paras: [draft.trim()]
      }]);
      setDraft("");
      setSending(false);
      setSaveState("none");
    }, 700);
  }
  const activeThread = threads.find(t => t.id === thread);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "var(--surface-app)",
      fontFamily: "var(--font-ui)"
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    active: "Meine Gruppen",
    onSelect: i => i === "Meine Gruppen" && onOpenGroups && onOpenGroups()
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "stretch",
      flex: 1,
      minHeight: 0
    }
  }, leftOpen ? /*#__PURE__*/React.createElement("aside", {
    style: {
      flex: "none",
      width: "var(--rail-left-w)",
      boxSizing: "border-box",
      background: "var(--surface-rail)",
      borderRight: "1px solid var(--border-subtle)",
      padding: "16px 11px",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      padding: "0 5px 9px"
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Meine Gruppen"), /*#__PURE__*/React.createElement("span", {
    onClick: () => setLeftOpen(false),
    style: {
      marginLeft: "auto",
      cursor: "pointer",
      fontSize: 13,
      color: "var(--text-label)",
      padding: "2px 6px",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-xs)",
      lineHeight: 1.1
    }
  }, "\u2039")), /*#__PURE__*/React.createElement(GroupList, {
    groups: [{
      id: "em",
      name: "Der Erinnerungsmarkt"
    }, {
      id: "ka",
      name: "Königreich aus Asche"
    }, {
      id: "mr",
      name: "Mondlicht & Rosen"
    }],
    activeId: "em",
    onCreate: onCreateGroup
  })) : /*#__PURE__*/React.createElement(RailToggle, {
    side: "left",
    label: "Gruppen",
    onClick: () => setLeftOpen(true)
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(GroupHeader, {
    name: group || "Der Erinnerungsmarkt",
    visibility: "Privat",
    threadCount: 6,
    threadLimit: 12
  }), /*#__PURE__*/React.createElement(ThreadTabs, {
    threads: threads,
    activeId: thread,
    onSelect: setThread,
    onCreate: () => {}
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto",
      padding: "var(--space-11) var(--thread-gutter) var(--space-12)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--reading-max)"
    }
  }, /*#__PURE__*/React.createElement(ThreadHeader, {
    title: thread === "k1" ? "Kapitel 1 — Der Markt öffnet" : activeThread.name,
    postCount: thread === "k1" ? posts.length + 11 : 0,
    lastActivity: thread === "k1" ? "vor 12 Minuten" : undefined,
    lastAuthor: thread === "k1" ? "Bob" : undefined,
    onFilter: () => {}
  }), thread === "k1" ? posts.map((p, i) => /*#__PURE__*/React.createElement(Post, {
    key: p.id,
    author: p.author,
    time: p.time,
    edited: p.edited,
    bookmarked: p.bookmarked,
    notesCount: p.notes ? p.notes.length : undefined,
    notesOpen: !!openNotes[p.id],
    onToggleNotes: () => setOpenNotes(o => ({
      ...o,
      [p.id]: !o[p.id]
    })),
    divider: i < posts.length - 1,
    style: i === 0 ? {
      paddingTop: 0
    } : undefined
  }, p.paras.map((t, j) => /*#__PURE__*/React.createElement("p", {
    key: j
  }, t)), p.notes && openNotes[p.id] && /*#__PURE__*/React.createElement(NotesThread, {
    notes: p.notes,
    onWrite: () => {}
  }))) : /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-control)",
      color: "var(--text-muted)",
      lineHeight: 1.7
    }
  }, "Noch keine Beitr\xE4ge in \u201E", activeThread.name, "\u201C. Schreib den ersten."))), /*#__PURE__*/React.createElement(Composer, {
    value: draft,
    onChange: e => setDraft(e.target.value),
    saveState: draft ? saveState : "none",
    submitting: sending,
    onSubmit: send,
    onPreview: () => {},
    collapsed: !editorOpen,
    onToggleCollapse: () => setEditorOpen(v => !v)
  })), rightOpen ? /*#__PURE__*/React.createElement("aside", {
    style: {
      flex: "none",
      width: "var(--rail-right-w)",
      boxSizing: "border-box",
      background: "var(--surface-rail)",
      borderLeft: "1px solid var(--border-subtle)",
      padding: "16px 14px",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-9)",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Gruppen-Kontext"), /*#__PURE__*/React.createElement("span", {
    onClick: () => setRightOpen(false),
    style: {
      marginLeft: "auto",
      cursor: "pointer",
      fontSize: 13,
      color: "var(--text-label)",
      padding: "2px 6px",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-xs)",
      lineHeight: 1.1
    }
  }, "\u203A")), /*#__PURE__*/React.createElement(StepList, {
    steps: steps,
    doneOpen: doneOpen,
    onToggleDone: () => setDoneOpen(v => !v),
    onAdd: () => {},
    onToggle: id => setSteps(s => s.map(x => x.id === id ? {
      ...x,
      done: !x.done
    } : x))
  }), /*#__PURE__*/React.createElement(StoryStatus, {
    fields: [{
      label: "Status",
      value: "Wird geschrieben",
      strong: true
    }, {
      label: "Genre",
      value: "Fantasy, Mystery"
    }, {
      label: "Perspektive",
      value: "3. Person, Vergangenheit"
    }]
  }), /*#__PURE__*/React.createElement(FileList, {
    total: 12,
    onAll: () => {},
    files: [{
      name: "stadtkarte.png",
      type: "png"
    }, {
      name: "mira-referenz.png",
      type: "png"
    }, {
      name: "zeitleiste.md",
      type: "md"
    }]
  }), /*#__PURE__*/React.createElement(MemberList, {
    members: [{
      name: "Alice",
      role: "Admin"
    }, {
      name: "Bob",
      role: "Autor"
    }, {
      name: "Carol",
      role: "Leserin"
    }],
    onInvite: () => {}
  })) : /*#__PURE__*/React.createElement(RailToggle, {
    side: "right",
    label: "Gruppen-Kontext",
    onClick: () => setRightOpen(true)
  })));
}
window.Kit = Object.assign(window.Kit || {}, {
  ThreadPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_desktop/ThreadPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_mobile/MobileThread.jsx
try { (() => {
/* The same thread page at 390px. Mobile was a top complaint about the old platform:
   it had no mobile layout at all. Rules: prose stays 17px, targets >= 44px, threads stay
   tabs, the rails become sheets (never drawers over the text), the composer is a fixed
   one-line bar that expands on focus. */
function MobileThread() {
  const {
    ThreadTabs,
    Post,
    NotesThread,
    Badge,
    Avatar,
    StepList,
    MemberList,
    FileList,
    StoryStatus,
    Label,
    Button,
    SearchField
  } = window.DS;
  const threads = [{
    id: "k1",
    name: "Kapitel 1"
  }, {
    id: "k2",
    name: "Kapitel 2"
  }, {
    id: "ip",
    name: "Ideen & Planung"
  }, {
    id: "ch",
    name: "Charaktere"
  }, {
    id: "wb",
    name: "Worldbuilding"
  }];
  const [thread, setThread] = React.useState("k1");
  const [sheet, setSheet] = React.useState(null); // null | "context" | "groups"
  const [expanded, setExpanded] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [tab, setTab] = React.useState("Gruppen");
  const [doneOpen, setDoneOpen] = React.useState(false);
  const [steps, setSteps] = React.useState([{
    id: "s1",
    text: "Keshs Motiv festlegen",
    author: "Bob"
  }, {
    id: "s2",
    text: "Kapitel 2 anlegen",
    author: "Alice"
  }, {
    id: "s3",
    text: "Marktszene beginnen",
    done: true
  }]);
  const G = "var(--thread-gutter-mobile)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--surface-app)",
      fontFamily: "var(--font-ui)",
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      height: "var(--topbar-h-mobile)",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)",
      padding: `0 ${G}`,
      background: "var(--surface-raised)",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-wordmark)",
      color: "#3a3229"
    }
  }, "Calliope"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(SearchField, {
    width: 128
  }), /*#__PURE__*/React.createElement(Avatar, {
    name: "Alice",
    size: "sm"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      padding: `var(--space-7) ${G} 0`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-4)",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: "400 21px/1.25 var(--font-prose)",
      color: "var(--text-title)"
    }
  }, "Der Erinnerungsmarkt"), /*#__PURE__*/React.createElement(Badge, null, "Privat")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)",
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    level: "outline",
    size: "sm",
    style: {
      minHeight: "var(--tap-min)"
    },
    onClick: () => setSheet("context")
  }, "Gruppen-Kontext"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-hint)",
      color: "var(--text-muted)"
    }
  }, "6 von 12 Threads"))), /*#__PURE__*/React.createElement(ThreadTabs, {
    threads: threads,
    activeId: thread,
    onSelect: setThread,
    onCreate: () => {},
    gutter: G
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto",
      padding: `var(--space-9) ${G} var(--space-9)`
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 5px",
      font: "400 18px/1.3 var(--font-prose)",
      color: "var(--text-title)"
    }
  }, "Kapitel 1 \u2014 Der Markt \xF6ffnet"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-control)",
      color: "var(--text-muted)",
      marginBottom: "var(--space-9)"
    }
  }, "14 Beitr\xE4ge \xB7 zuletzt vor 12 Minuten von Bob"), /*#__PURE__*/React.createElement(Post, {
    author: "Alice",
    time: "Dienstag, 09:14",
    notesCount: 2,
    notesOpen: notesOpen,
    onToggleNotes: () => setNotesOpen(v => !v),
    style: {
      paddingTop: 0
    }
  }, /*#__PURE__*/React.createElement("p", null, "Der Markt \xF6ffnete immer erst, wenn das letzte Licht aus den Fenstern der Weberstra\xDFe gewichen war. Mira wusste das, seit sie sieben war."), /*#__PURE__*/React.createElement("p", null, "Sie zog den Kragen h\xF6her und trat zwischen die St\xE4nde. \xD6l, Papier, kalter Stein."), notesOpen && /*#__PURE__*/React.createElement(NotesThread, {
    onWrite: () => {},
    notes: [{
      author: "Bob",
      time: "vor 20 Min.",
      text: "Der zweite Absatz ist stark."
    }, {
      author: "Carol",
      time: "vor 8 Min.",
      text: "Als Leserin: der Einstieg hat mich sofort drin gehabt."
    }]
  })), /*#__PURE__*/React.createElement(Post, {
    author: "Bob",
    time: "vor 12 Minuten",
    edited: true,
    bookmarked: true,
    divider: false
  }, /*#__PURE__*/React.createElement("p", null, "Kesh sah das M\xE4dchen, bevor es ihn sah \u2014 daran erkannte er die Gewohnten."))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      borderTop: "1px solid var(--border-subtle)",
      background: "var(--surface-raised)",
      padding: `var(--space-5) ${G}`
    }
  }, expanded ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)",
      marginBottom: "var(--space-4)",
      font: "var(--text-control)",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-secondary)"
    }
  }, "Weiterschreiben"), draft ? /*#__PURE__*/React.createElement("span", null, "Entwurf gespeichert") : null, /*#__PURE__*/React.createElement("span", {
    onClick: () => setExpanded(false),
    style: {
      marginLeft: "auto",
      cursor: "pointer",
      color: "var(--action-quiet-fg)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-control)",
      padding: "6px 10px"
    }
  }, "Schlie\xDFen \u2304")), /*#__PURE__*/React.createElement("textarea", {
    autoFocus: true,
    value: draft,
    onChange: e => setDraft(e.target.value),
    rows: 4,
    placeholder: "Mira antwortete nicht sofort \u2026",
    style: {
      width: "100%",
      boxSizing: "border-box",
      border: "none",
      outline: "none",
      resize: "none",
      background: "transparent",
      font: "var(--text-composer)",
      color: "var(--text-draft)",
      caretColor: "var(--caret)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-5)",
      borderTop: "1px solid var(--border-hairline)",
      paddingTop: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-7)",
      font: "var(--text-control)",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, "B"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "I"), /*#__PURE__*/React.createElement("span", null, "\u201E\""), /*#__PURE__*/React.createElement("span", null, "Bild")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    level: "solid",
    size: "lg",
    style: {
      minHeight: "var(--tap-min)"
    }
  }, "Senden")))) : /*#__PURE__*/React.createElement("div", {
    onClick: () => setExpanded(true),
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-5)",
      minHeight: "var(--tap-min)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: "400 15px/1.4 var(--font-prose)",
      color: "var(--text-muted)"
    }
  }, "Weiterschreiben \u2026"), /*#__PURE__*/React.createElement(Button, {
    level: "outline",
    size: "sm",
    style: {
      minHeight: 38
    }
  }, "Editor"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      height: "var(--bottombar-h-mobile)",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "stretch",
      borderTop: "1px solid var(--border-subtle)",
      background: "var(--surface-raised)"
    }
  }, ["Gruppen", "Forum", "Partner", "Post"].map(t => {
    const on = t === tab;
    return /*#__PURE__*/React.createElement("button", {
      key: t,
      onClick: () => {
        setTab(t);
        if (t === "Gruppen") setSheet("groups");
      },
      style: {
        flex: 1,
        minHeight: "var(--tap-min)",
        background: "none",
        border: "none",
        cursor: "pointer",
        font: "var(--text-control)",
        color: on ? "var(--text-title)" : "var(--text-muted)",
        fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
        boxShadow: on ? "inset 0 2px 0 var(--tab-active-underline)" : "none"
      }
    }, t);
  })), sheet && /*#__PURE__*/React.createElement("div", {
    onClick: () => setSheet(null),
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(43,38,32,.20)",
      display: "flex",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxHeight: "78%",
      overflowY: "auto",
      background: "var(--surface-rail)",
      borderTop: "1px solid var(--border-strong)",
      boxShadow: "var(--shadow-sheet)",
      padding: `var(--space-7) ${G} var(--space-9)`,
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-9)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Label, null, sheet === "context" ? "Gruppen-Kontext" : "Meine Gruppen"), /*#__PURE__*/React.createElement("span", {
    onClick: () => setSheet(null),
    style: {
      marginLeft: "auto",
      cursor: "pointer",
      minHeight: 34,
      font: "var(--text-control)",
      color: "var(--action-quiet-fg)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-control)",
      padding: "7px 12px"
    }
  }, "Schlie\xDFen")), sheet === "context" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StepList, {
    steps: steps,
    doneOpen: doneOpen,
    onToggleDone: () => setDoneOpen(v => !v),
    onAdd: () => {},
    onToggle: id => setSteps(s => s.map(x => x.id === id ? {
      ...x,
      done: !x.done
    } : x))
  }), /*#__PURE__*/React.createElement(StoryStatus, {
    fields: [{
      label: "Status",
      value: "Wird geschrieben",
      strong: true
    }, {
      label: "Genre",
      value: "Fantasy, Mystery"
    }, {
      label: "Perspektive",
      value: "3. Person, Vergangenheit"
    }]
  }), /*#__PURE__*/React.createElement(FileList, {
    total: 12,
    onAll: () => {},
    files: [{
      name: "stadtkarte.png",
      type: "png"
    }, {
      name: "zeitleiste.md",
      type: "md"
    }]
  }), /*#__PURE__*/React.createElement(MemberList, {
    sticky: false,
    members: [{
      name: "Alice",
      role: "Admin"
    }, {
      name: "Bob",
      role: "Autor"
    }, {
      name: "Carol",
      role: "Leserin"
    }],
    onInvite: () => {}
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      font: "var(--text-row)"
    }
  }, [["Der Erinnerungsmarkt", true], ["Königreich aus Asche", false], ["Mondlicht & Rosen", false]].map(([n, on]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      minHeight: "var(--tap-min)",
      display: "flex",
      alignItems: "center",
      padding: "0 var(--space-5)",
      background: on ? "var(--surface-raised)" : "transparent",
      border: `1px solid ${on ? "var(--border-strong)" : "transparent"}`,
      borderRadius: "var(--radius-control)",
      fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
      color: on ? "var(--text-title)" : "var(--text-secondary)"
    }
  }, n)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    level: "quiet",
    block: true,
    style: {
      minHeight: "var(--tap-min)"
    }
  }, "\uFF0B Gruppe gr\xFCnden"))))));
}
window.Kit = Object.assign(window.Kit || {}, {
  MobileThread
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_mobile/MobileThread.jsx", error: String((e && e.message) || e) }); }

__ds_ns.FileList = __ds_scope.FileList;

__ds_ns.MemberList = __ds_scope.MemberList;

__ds_ns.StepList = __ds_scope.StepList;

__ds_ns.StoryStatus = __ds_scope.StoryStatus;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.PanelCard = __ds_scope.PanelCard;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.GroupList = __ds_scope.GroupList;

__ds_ns.RailToggle = __ds_scope.RailToggle;

__ds_ns.ThreadTabs = __ds_scope.ThreadTabs;

__ds_ns.TopBar = __ds_scope.TopBar;

__ds_ns.Composer = __ds_scope.Composer;

__ds_ns.GroupHeader = __ds_scope.GroupHeader;

__ds_ns.NotesThread = __ds_scope.NotesThread;

__ds_ns.Post = __ds_scope.Post;

__ds_ns.ThreadHeader = __ds_scope.ThreadHeader;

})();
