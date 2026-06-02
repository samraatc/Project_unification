{{- define "unified-storefront.name" -}}{{ .Chart.Name }}{{- end -}}

{{- define "unified-storefront.fullname" -}}
{{- if .Values.fullnameOverride -}}{{ .Values.fullnameOverride }}{{- else -}}{{ .Release.Name }}-{{ include "unified-storefront.name" . }}{{- end -}}
{{- end -}}

{{- define "unified-storefront.labels" -}}
app.kubernetes.io/name: {{ include "unified-storefront.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "unified-storefront.selectorLabels" -}}
app.kubernetes.io/name: {{ include "unified-storefront.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
