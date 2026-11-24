"""Genera las piezas p-* del sprite de Appollo (lienzo 200x200, pieza centrada en 100,100) y las inserta en body.html."""
import re, sys
L = "fill:none;stroke:var(--il-ojo);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke"
T = L.replace("--il-ojo", "--il-trazo")
f = lambda v: f'style="fill:var({v})"'
P = {}
# ---------- Ave (de frente, erguida; cuerpo entre y=40 y y=160) ----------
P["p-cuerpo"] = f'<path {f("--il-c1")} d="M100 40C131 40 146 66 146 102C146 139 127 160 100 160S54 139 54 102C54 66 69 40 100 40Z"/>'
P["p-cuerpo-robusto"] = f'<path {f("--il-c1")} d="M100 50C139 50 160 77 160 110C160 143 135 163 100 163S40 143 40 110C40 77 61 50 100 50Z"/>'
P["p-cuerpo-esbelto"] = f'<path {f("--il-c1")} d="M100 32C124 32 138 58 138 97C138 137 123 160 100 160S62 137 62 97C62 58 76 32 100 32Z"/>'
P["p-ala"] = f'<g {f("--il-c2")}><path d="M140 100C157 104 160 126 146 140C134 133 131 114 140 100Z"/><path d="M60 100C43 104 40 126 54 140C66 133 69 114 60 100Z"/></g>'
P["p-cola"] = f'<path {f("--il-c3")} d="M136 86C152 70 170 74 169 90C168 103 152 108 140 106Z"/>'
P["p-cola-alta"] = f'<path {f("--il-c3")} d="M134 84C144 52 170 46 174 66C178 88 158 106 140 106Z"/>'
P["p-cresta"] = f'<path {f("--il-cresta")} d="M84 50C80 36 92 30 98 40C100 28 114 28 114 40C121 33 130 40 123 52Z"/>'
P["p-cresta-grande"] = f'<path {f("--il-cresta")} d="M80 52C72 34 86 24 94 36C96 20 114 20 114 36C122 24 138 32 128 48C136 46 136 56 128 58Z"/>'
P["p-pico"] = f'<path {f("--p-durazno")} d="M91 87Q100 82 109 87Q106 99 100 102Q94 99 91 87Z"/>'
P["p-barba"] = f'<path {f("--il-cresta")} d="M100 101C107 102 108 112 100 118C92 112 93 102 100 101Z"/>'
P["p-ojos"] = f'<g {f("--il-ojo")}><circle cx="84" cy="78" r="3.6"/><circle cx="116" cy="78" r="3.6"/></g>'
P["p-ojos-cerrados"] = f'<path style="{L}" d="M78 79Q84 84 90 79M110 79Q116 84 122 79"/>'
P["p-patas"] = f'<path style="{T}" d="M88 158V178M80 183L88 178L96 183M112 158V178M104 183L112 178L120 183"/>'
P["p-barrado"] = f'<g {f("--il-c2")}><rect x="64" y="104" width="72" height="7" rx="3.5"/><rect x="62" y="120" width="76" height="7" rx="3.5"/><rect x="66" y="136" width="68" height="7" rx="3.5"/></g>'
P["p-sombra"] = f'<ellipse {f("--il-sombra")} cx="100" cy="182" rx="50" ry="7"/>'
P["p-pollito"] = (f'<ellipse {f("--ave-pollito")} cx="100" cy="112" rx="40" ry="38"/><path {f("--p-durazno")} d="M120 112C134 112 136 128 126 136C118 130 116 120 120 112Z"/>'
                  f'<g {f("--il-ojo")}><circle cx="88" cy="104" r="3"/><circle cx="112" cy="104" r="3"/></g><path {f("--p-durazno")} d="M94 112Q100 108 106 112Q103 120 100 121Q97 120 94 112Z"/>'
                  f'<path style="{T}" d="M90 148V160M84 163L90 160L96 163M110 148V160M104 163L110 160L116 163"/>')
# ---------- Objetos (centrados en 100,100) ----------
P["p-bebedero"] = (f'<rect {f("--p-salvia")} x="88" y="44" width="24" height="16" rx="6"/><path {f("--p-salvia")} d="M78 60H122L132 128H68Z"/>'
                   f'<rect {f("--ave-hueso")} x="54" y="126" width="92" height="16" rx="8"/><rect {f("--cielo")} x="62" y="128" width="76" height="6" rx="3"/><rect {f("--p-salvia")} x="50" y="140" width="100" height="14" rx="7"/>')
P["p-comedero"] = (f'<rect {f("--p-durazno")} x="78" y="40" width="44" height="86" rx="14"/><rect {f("--ave-hueso")} x="86" y="56" width="28" height="10" rx="5"/>'
                   f'<path {f("--ave-marron")} d="M52 124H148L140 152Q100 160 60 152Z"/><g {f("--p-durazno")}><circle cx="82" cy="128" r="5"/><circle cx="98" cy="126" r="5"/><circle cx="114" cy="128" r="5"/></g>')
P["p-saco"] = (f'<path {f("--ave-marron")} d="M70 58Q100 46 130 58L140 148Q100 160 60 148Z"/><path {f("--ave-marron")} d="M82 46Q100 34 118 46L112 62H88Z"/>'
               f'<rect {f("--ave-hueso")} x="74" y="90" width="52" height="30" rx="8"/>')
P["p-termometro"] = (f'<rect {f("--ave-hueso")} x="86" y="34" width="28" height="104" rx="14"/><circle {f("--p-coral")} cx="100" cy="146" r="22"/>'
                     f'<rect {f("--p-coral")} x="94" y="78" width="12" height="70" rx="6"/><path style="{L}" d="M116 56H124M116 76H124M116 96H124M116 116H124"/>')
P["p-gota"] = f'<path {f("--cielo")} d="M100 36C114 60 140 88 140 116C140 140 122 158 100 158S60 140 60 116C60 88 86 60 100 36Z"/><path {f("--ave-hueso")} d="M80 118C80 104 86 94 92 88C90 100 88 110 90 124Z"/>'
P["p-ventilador"] = (f'<circle {f("--ave-hueso")} cx="100" cy="96" r="56"/><g {f("--p-salvia")}><path d="M100 96C92 70 100 52 114 54C124 66 116 84 100 96Z"/>'
                     f'<path d="M100 96C126 90 140 102 136 116C122 122 108 110 100 96Z"/><path d="M100 96C82 116 64 116 58 104C64 88 84 88 100 96Z"/></g>'
                     f'<circle {f("--il-ojo")} cx="100" cy="96" r="6"/><rect {f("--ave-gris")} x="90" y="150" width="20" height="10" rx="5"/><rect {f("--ave-gris")} x="70" y="158" width="60" height="10" rx="5"/>')
P["p-foco"] = (f'<rect {f("--ave-gris")} x="96" y="20" width="8" height="36" rx="4"/><rect {f("--ave-gris")} x="86" y="54" width="28" height="20" rx="6"/>'
               f'<circle {f("--ave-pollito")} cx="100" cy="104" r="34"/><path {f("--ave-hueso")} d="M84 98C86 88 92 82 100 80C94 88 92 94 92 104Z"/>')
P["p-galpon"] = (f'<path {f("--p-coral")} d="M100 40L162 86Q166 92 158 92H42Q34 92 38 86Z"/><rect {f("--ave-hueso")} x="50" y="90" width="100" height="70" rx="6"/>'
                 f'<rect {f("--ave-marron")} x="86" y="112" width="28" height="48" rx="6"/><rect {f("--p-cielo")} x="60" y="104" width="18" height="16" rx="4"/><rect {f("--p-cielo")} x="122" y="104" width="18" height="16" rx="4"/>')
P["p-botas"] = (f'<path {f("--p-salvia")} d="M60 60H86V128Q86 132 92 134L100 138Q106 142 102 150H56Q52 150 52 144V68Q52 60 60 60Z"/>'
                f'<path {f("--p-salvia")} d="M112 60H138V128Q138 132 144 134L152 138Q158 142 154 150H108Q104 150 104 144V68Q104 60 112 60Z"/><rect {f("--ave-gris")} x="50" y="146" width="108" height="10" rx="5"/>')
P["p-vacuna"] = (f'<rect {f("--ave-gris")} x="84" y="40" width="32" height="18" rx="6"/><rect {f("--ave-hueso")} x="76" y="56" width="48" height="100" rx="16"/>'
                 f'<rect {f("--cielo")} x="82" y="104" width="36" height="46" rx="12"/><rect {f("--p-lila")} x="82" y="70" width="36" height="22" rx="6"/>')
P["p-balanza"] = (f'<rect {f("--ave-gris")} x="48" y="132" width="104" height="26" rx="12"/><rect {f("--ave-hueso")} x="70" y="66" width="60" height="62" rx="14"/>'
                  f'<path style="{L}" d="M100 102L114 84M84 82Q100 72 116 82"/><rect {f("--ave-gris")} x="94" y="126" width="12" height="10" rx="3"/>')
P["p-huevo"] = f'<path {f("--ave-hueso")} d="M100 44C122 44 140 80 140 110C140 136 122 154 100 154S60 136 60 110C60 80 78 44 100 44Z"/>'
P["p-nido"] = f'<path {f("--ave-marron")} d="M36 104H164Q160 156 100 158Q40 156 36 104Z"/><g {f("--il-c3")}><rect x="44" y="104" width="112" height="8" rx="4"/><rect x="54" y="124" width="92" height="6" rx="3"/></g>'
P["p-hoja"] = f'<path {f("--p-salvia")} d="M52 150C52 96 88 56 150 50C152 112 116 150 52 150Z"/><path style="{L}" d="M60 142C86 116 110 92 136 66"/>'
P["p-taza"] = (f'<path {f("--ave-hueso")} d="M54 80H136V118Q136 154 96 154Q54 154 54 118Z"/><path {f("--ave-hueso")} d="M134 90Q160 90 158 110Q156 128 134 128V118Q146 118 146 110Q146 100 134 100Z"/>'
               f'<rect {f("--ave-marron")} x="62" y="84" width="66" height="10" rx="5"/><rect {f("--ave-gris")} x="44" y="152" width="104" height="8" rx="4"/>')
P["p-frasco"] = (f'<rect {f("--ave-gris")} x="84" y="36" width="32" height="18" rx="6"/><path {f("--p-salvia")} d="M86 54H114V66Q140 76 140 100V146Q140 158 128 158H72Q60 158 60 146V100Q60 76 86 66Z"/>'
                 f'<rect {f("--ave-hueso")} x="72" y="102" width="56" height="34" rx="8"/>')
P["p-calendario"] = (f'<rect {f("--ave-hueso")} x="48" y="54" width="104" height="100" rx="16"/><path {f("--p-coral")} d="M48 78V68Q48 54 62 54H138Q152 54 152 68V78Z"/>'
                     f'<g {f("--il-ojo")}><circle cx="74" cy="104" r="4"/><circle cx="100" cy="104" r="4"/><circle cx="126" cy="104" r="4"/><circle cx="74" cy="128" r="4"/><circle cx="100" cy="128" r="4"/></g>'
                     f'<path style="{L}" d="M74 44V62M126 44V62"/>')
P["p-libreta"] = (f'<rect {f("--ave-hueso")} x="54" y="38" width="92" height="124" rx="14"/><rect {f("--p-lila")} x="54" y="38" width="16" height="124" rx="8"/>'
                  f'<path style="{L}" d="M84 72H130M84 100H130M84 128H116"/>')
P["p-reloj"] = f'<circle {f("--ave-gris")} cx="100" cy="100" r="58"/><circle {f("--ave-hueso")} cx="100" cy="100" r="48"/><path style="{L}" d="M100 100V70M100 100L118 110"/>'
P["p-escudo"] = f'<path {f("--p-salvia")} d="M100 36L150 54Q152 120 100 160Q48 120 50 54Z"/>'
P["p-flecha"] = f'<path {f("--p-salvia")} d="M46 92H114V68Q114 62 120 66L156 96Q160 100 156 104L120 134Q114 138 114 132V108H46Q40 108 40 100Q40 92 46 92Z"/>'
P["p-palomita"] = f'<circle {f("--p-salvia")} cx="100" cy="100" r="58"/><path style="fill:none;stroke:var(--il-ojo);stroke-width:12;stroke-linecap:round;stroke-linejoin:round" d="M72 102L92 122L130 82"/>'
P["p-lupa"] = (f'<rect {f("--ave-gris")} x="112" y="112" width="16" height="50" rx="8" transform="rotate(-45 120 137)"/><circle {f("--ave-gris")} cx="88" cy="88" r="44"/>'
               f'<circle {f("--ave-hueso")} cx="88" cy="88" r="34"/>')
P["p-raton"] = (f'<path style="{T}" d="M146 128Q170 132 166 112"/><ellipse {f("--ave-gris")} cx="108" cy="124" rx="40" ry="26"/><circle {f("--ave-gris")} cx="76" cy="100" r="14"/>'
                f'<circle {f("--il-ojo")} cx="78" cy="118" r="3"/><circle {f("--p-coral")} cx="68" cy="126" r="4"/>')
P["p-malla"] = (f'<rect {f("--ave-hueso")} x="44" y="44" width="112" height="112" rx="14"/><rect {f("--p-cielo")} x="56" y="56" width="88" height="88" rx="8"/>'
                f'<path style="{L}" d="M78 56V144M100 56V144M122 56V144M56 78H144M56 100H144M56 122H144"/>')
P["p-estante"] = (f'<g {f("--ave-marron")}><rect x="40" y="72" width="120" height="10" rx="5"/><rect x="40" y="130" width="120" height="10" rx="5"/>'
                  f'<rect x="46" y="72" width="10" height="92" rx="5"/><rect x="144" y="72" width="10" height="92" rx="5"/></g>')
P["p-criadora"] = (f'<rect {f("--ave-gris")} x="96" y="14" width="8" height="34" rx="4"/><path {f("--p-coral")} d="M100 44Q132 44 146 82H54Q68 44 100 44Z"/>'
                   f'<path {f("--ave-pollito")} style="opacity:.55" d="M58 84H142L170 160H30Z"/>')
P["p-cama"] = (f'<rect {f("--ave-marron")} x="30" y="146" width="140" height="14" rx="7"/><g {f("--ave-pollito")}><rect x="44" y="134" width="22" height="8" rx="4"/>'
               f'<rect x="80" y="130" width="26" height="8" rx="4" transform="rotate(-12 93 134)"/><rect x="124" y="134" width="24" height="8" rx="4" transform="rotate(10 136 138)"/></g>')

def sprite():
    return "\n".join(f'    <symbol id="{k}" viewBox="0 0 200 200">{v}</symbol>' for k, v in P.items())

if __name__ == "__main__":
    ruta = sys.argv[1]
    s = open(ruta, encoding="utf-8").read()
    s = re.sub(r'\n    <!-- piezas de ilustración -->.*?<!-- /piezas -->', '', s, flags=re.S)
    bloque = "\n    <!-- piezas de ilustración -->\n" + sprite() + "\n    <!-- /piezas -->"
    s = s.replace("\n  </defs>", bloque + "\n  </defs>", 1)
    open(ruta, "w", encoding="utf-8").write(s)
    print(len(P), "piezas,", len(sprite()), "bytes")
