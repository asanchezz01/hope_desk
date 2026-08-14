import { Redirect } from 'expo-router'
import React from 'react'

/**
 * A listagem mora na raiz (`/`), que é a tela principal do sistema. Esta rota
 * existe só para que `/tickets` — digitado à mão ou vindo de um link antigo —
 * caia no lugar certo em vez de na tela de "não encontrado".
 */
export default function TicketsIndexRedirect() {
  return <Redirect href="/" />
}
