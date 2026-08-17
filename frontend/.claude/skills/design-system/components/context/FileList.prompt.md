Group file list for the right rail.

```jsx
<FileList files={[{name:"stadtkarte.png",type:"png"},{name:"zeitleiste.md",type:"md"}]} total={12} onAll={openFiles} />
```

Do not render thumbnails here — the preview grid was explicitly rejected in favour of this list. The
type tag is mono text, never an icon.
