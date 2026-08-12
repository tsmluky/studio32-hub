// Cliente IMAP mínimo: solo sabe guardar una copia en Enviados.
//
// Por qué existe: entregar un correo por SMTP y guardarlo en "Enviados" son dos
// operaciones distintas contra dos servicios distintos. El SMTP entrega y se acaba;
// la copia la escribe siempre el cliente de correo por IMAP. Como aquí no hay
// cliente, los correos salían de verdad y la carpeta Enviados del webmail se
// quedaba vacía, que es justo lo que hacía dudar de si el envío había ocurrido.
//
// Por qué a mano y no una librería: de todo IMAP aquí solo hacen falta LOGIN, LIST
// y APPEND, que son tres comandos de texto. Las librerías de IMAP para Deno tiran de
// compatibilidad con Node (net, tls, streams) y meter esa apuesta en la función que
// envía los correos, que es la pieza que más caro sale que se rompa, no compensa por
// ahorrar sesenta líneas.
//
// No necesita credenciales nuevas: SMTP_USER y SMTP_PASS ya son la cuenta real del
// buzón (info@studio32.es), la misma que se autentica para enviar.

const LIMITE_MS = 15_000

// Un IMAP que no contesta no puede colgar la tanda.
//
// Sin esto, un socket que se queda a medias bloquea el bucle de envío entero: los
// correos que faltan no salen, y el que provocó la espera YA se entregó. La copia es
// lo accesorio; que se pierda una copia es aceptable, que se pierda un envío no.
function conLimite<T>(promesa: Promise<T>, queHacia: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error(`El servidor IMAP no respondió al ${queHacia}.`)), LIMITE_MS)
    promesa.then(
      (valor) => { clearTimeout(reloj); resolve(valor) },
      (error) => { clearTimeout(reloj); reject(error) },
    )
  })
}

function entrecomillar(valor: string) {
  return `"${valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export class SesionImap {
  #conn: Deno.TlsConn
  #restos = new Uint8Array(0)
  #encoder = new TextEncoder()
  #decoder = new TextDecoder()
  #etiqueta = 0

  private constructor(conn: Deno.TlsConn) {
    this.#conn = conn
  }

  static async abrir(hostname: string, port: number, usuario: string, contrasena: string) {
    const conn = await conLimite(Deno.connectTls({ hostname, port }), 'conectar')
    const sesion = new SesionImap(conn)
    // El servidor saluda solo, antes de que nadie le pregunte nada.
    await conLimite(sesion.#leerLinea(), 'saludar')
    await sesion.#ejecutar(`LOGIN ${entrecomillar(usuario)} ${entrecomillar(contrasena)}`, 'identificarse')
    return sesion
  }

  // La carpeta de enviados no se llama igual en todos los servidores: puede ser
  // "Sent", "INBOX.Sent" o el nombre traducido. Adivinarla a ciegas deja la copia en
  // una carpeta nueva que nadie mira, así que se pregunta: el propio servidor marca
  // cuál es la suya con el atributo \Sent.
  async carpetaDeEnviados() {
    const lineas = await this.#ejecutar('LIST "" "*"', 'listar las carpetas')
    const candidatas: string[] = []
    for (const linea of lineas) {
      const partes = linea.match(/^\* LIST \(([^)]*)\)\s+(?:"[^"]*"|NIL)\s+(?:"(.*)"|(\S+))\s*$/)
      if (!partes) continue
      const atributos = partes[1].toLowerCase()
      const nombre = partes[2] ?? partes[3] ?? ''
      if (!nombre) continue
      if (atributos.includes('\\sent')) return nombre
      candidatas.push(nombre)
    }
    // Sin atributo \Sent, los nombres de siempre. Y si tampoco están, se dice: es
    // mejor no escribir la copia que crear una carpeta que nadie va a abrir.
    const habitual = candidatas.find((nombre) => /^(inbox[./])?sent(\s|$)|enviados/i.test(nombre))
    if (habitual) return habitual
    throw new Error('El servidor IMAP no declara ninguna carpeta de enviados.')
  }

  async guardarEnEnviados(carpeta: string, mensaje: string) {
    const bytes = this.#encoder.encode(mensaje)
    // El tamaño del literal va en BYTES, no en caracteres. Con acentos y con el
    // cuerpo en base64 no es lo mismo, y pasarse o quedarse corto descoloca el
    // protocolo entero: el servidor sigue leyendo el mensaje como si fueran comandos.
    const etiqueta = this.#siguienteEtiqueta()
    await this.#escribir(`${etiqueta} APPEND ${entrecomillar(carpeta)} (\\Seen) {${bytes.length}}\r\n`)

    const respuesta = await conLimite(this.#leerLinea(), 'aceptar la copia')
    if (!respuesta.startsWith('+')) throw new Error(`El servidor IMAP rechazó la copia: ${respuesta}`)

    await this.#escribirBytes(bytes)
    await this.#escribir('\r\n')
    await this.#leerHastaEtiqueta(etiqueta, 'guardar la copia')
  }

  async cerrar() {
    try {
      await this.#ejecutar('LOGOUT', 'despedirse')
    } catch {
      // Despedirse mal no invalida una copia ya escrita.
    }
    try {
      this.#conn.close()
    } catch {
      // Ya estaba cerrada.
    }
  }

  #siguienteEtiqueta() {
    this.#etiqueta += 1
    return `s${this.#etiqueta}`
  }

  async #ejecutar(comando: string, queHacia: string) {
    const etiqueta = this.#siguienteEtiqueta()
    await this.#escribir(`${etiqueta} ${comando}\r\n`)
    return await this.#leerHastaEtiqueta(etiqueta, queHacia)
  }

  async #leerHastaEtiqueta(etiqueta: string, queHacia: string) {
    const lineas: string[] = []
    for (;;) {
      const linea = await conLimite(this.#leerLinea(), queHacia)
      if (linea.startsWith(`${etiqueta} `)) {
        if (!/^\S+ OK/i.test(linea)) throw new Error(`IMAP falló al ${queHacia}: ${linea}`)
        return lineas
      }
      lineas.push(linea)
    }
  }

  async #escribir(texto: string) {
    await this.#escribirBytes(this.#encoder.encode(texto))
  }

  async #escribirBytes(bytes: Uint8Array) {
    let escritos = 0
    while (escritos < bytes.length) {
      escritos += await this.#conn.write(bytes.subarray(escritos))
    }
  }

  async #leerLinea() {
    for (;;) {
      const corte = this.#buscarFinDeLinea()
      if (corte >= 0) {
        const linea = this.#decoder.decode(this.#restos.subarray(0, corte))
        this.#restos = this.#restos.slice(corte + 2)
        return linea
      }
      const trozo = new Uint8Array(8192)
      const leidos = await this.#conn.read(trozo)
      if (leidos === null) throw new Error('El servidor IMAP cerró la conexión.')
      const combinado = new Uint8Array(this.#restos.length + leidos)
      combinado.set(this.#restos)
      combinado.set(trozo.subarray(0, leidos), this.#restos.length)
      this.#restos = combinado
    }
  }

  #buscarFinDeLinea() {
    for (let i = 0; i + 1 < this.#restos.length; i += 1) {
      if (this.#restos[i] === 13 && this.#restos[i + 1] === 10) return i
    }
    return -1
  }
}
