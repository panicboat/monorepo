## ADDED Requirements

### Requirement: Draggable Horizontal Scroll (MUST)
横スクロール可能なセクションは、マウスドラッグ（PC）およびタッチ（SP）の両方で直感的にスクロールできなければならない (MUST)。

#### Scenario: Drag on PC
- **WHEN** PCブラウザで横スクロール領域をマウスでドラッグしたとき
- **THEN** スムーズにスクロールし、慣性スクロールが効くこと。

### Requirement: Scroll Affordance (MUST)
横スクロール可能なセクションは、次項目の存在を視覚的に示唆（チラ見せ）しなければならない (MUST)。

#### Scenario: View Carousel
- **WHEN** カルーセルが表示されたとき
- **THEN** 右端のアイテムが完全には表示されず、一部が見切れている状態で表示され、続きがあることがわかる。
