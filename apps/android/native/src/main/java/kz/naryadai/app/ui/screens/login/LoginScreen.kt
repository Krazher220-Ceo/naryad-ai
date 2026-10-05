package kz.naryadai.app.ui.screens.login

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kz.naryadai.app.NaryadApplication
import kz.naryadai.app.R
import kz.naryadai.app.ui.theme.AccentYellow
import kz.naryadai.app.ui.theme.BrandNavy
import kz.naryadai.app.ui.theme.CanvasBg
import kz.naryadai.app.ui.theme.DangerRed
import kz.naryadai.app.ui.theme.DangerSoft
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.InkPrimary
import kz.naryadai.app.ui.theme.LineBorder
import kz.naryadai.app.ui.theme.SurfaceWhite

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.current
    val app = NaryadApplication.get(context)
    val scope = rememberCoroutineScope()

    var login by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var currentLang by remember { mutableStateOf(app.sessionManager.language) }

    fun switchLanguage(lang: String) {
        currentLang = lang
        app.sessionManager.language = lang
        app.applyLocale(lang)
    }

    fun submitLogin() {
        if (login.isBlank() || password.isBlank()) {
            errorMessage = context.getString(R.string.auth_error_empty)
            return
        }

        isLoading = true
        errorMessage = null

        scope.launch {
            val result = app.supabaseManager.signIn(login, password)
            isLoading = false
            if (result.isSuccess) {
                onLoginSuccess()
            } else {
                val ex = result.exceptionOrNull()
                errorMessage = ex?.message ?: context.getString(R.string.auth_error_invalid)
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CanvasBg)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Переключатель языка
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.End
            ) {
                OutlinedButton(
                    onClick = { switchLanguage(if (currentLang == "ru") "kk" else "ru") },
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = BrandNavy
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (currentLang == "ru") "Қазақша" else "Русский",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            }

            // Логотип и заголовок
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .background(BrandNavy, RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Build,
                    contentDescription = null,
                    tint = AccentYellow,
                    modifier = Modifier.size(40.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = stringResource(R.string.app_name),
                fontSize = 32.sp,
                fontWeight = FontWeight.ExtraBold,
                color = InkPrimary
            )

            Text(
                text = stringResource(R.string.app_description),
                fontSize = 15.sp,
                color = InkMuted,
                modifier = Modifier.padding(top = 4.dp, bottom = 24.dp)
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = stringResource(R.string.auth_title),
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = InkPrimary
                    )

                    // Ошибка
                    if (!errorMessage.isNullOrBlank()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(DangerSoft, RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Text(
                                text = errorMessage ?: "",
                                color = DangerRed,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    // Логин
                    OutlinedTextField(
                        value = login,
                        onValueChange = { login = it },
                        label = { Text(stringResource(R.string.auth_login)) },
                        placeholder = { Text(stringResource(R.string.auth_login_hint)) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("login_input"),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Text,
                            imeAction = ImeAction.Next
                        ),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = BrandNavy,
                            unfocusedBorderColor = LineBorder
                        ),
                        shape = RoundedCornerShape(14.dp)
                    )

                    // Пароль
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text(stringResource(R.string.auth_password)) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("password_input"),
                        singleLine = true,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = { submitLogin() }
                        ),
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = stringResource(
                                        if (passwordVisible) R.string.auth_hide_password else R.string.auth_show_password
                                    )
                                )
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = BrandNavy,
                            unfocusedBorderColor = LineBorder
                        ),
                        shape = RoundedCornerShape(14.dp)
                    )

                    // Кнопка входа (56dp min)
                    Button(
                        onClick = { submitLogin() },
                        enabled = !isLoading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .testTag("login_submit_button"),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = BrandNavy,
                            disabledContainerColor = BrandNavy.copy(alpha = 0.5f)
                        ),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = Color.White,
                                strokeWidth = 2.5.dp
                            )
                        } else {
                            Text(
                                text = stringResource(R.string.auth_submit),
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = stringResource(R.string.auth_demo_hint),
                fontSize = 13.sp,
                color = InkMuted
            )
        }
    }
}
